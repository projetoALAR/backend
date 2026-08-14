import { BadRequestException } from '@nestjs/common';
import { ClientesExtracaoService } from './clientes-extracao.service';
import { LlmService } from '../chat/llm.service';
import { ChatQuotaService } from '../chat/chat-quota.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Role } from '../auth/roles';

const getText = jest.fn();
const destroy = jest.fn().mockResolvedValue(undefined);

jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText,
    destroy,
  })),
}));

function arquivo(
  partial: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'arquivo',
    originalname: 'documento.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 4,
    buffer: Buffer.from('%PDF'),
    stream: undefined as unknown as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
    ...partial,
  };
}

describe('ClientesExtracaoService', () => {
  const llm = {
    extrairDadosEstruturados: jest.fn(),
  };
  const chatQuota = {
    assertPodeUsar: jest.fn().mockResolvedValue(undefined),
  };
  const auditoria = {
    registrar: jest.fn().mockResolvedValue(undefined),
  };

  let service: ClientesExtracaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    chatQuota.assertPodeUsar.mockResolvedValue(undefined);
    auditoria.registrar.mockResolvedValue(undefined);
    service = new ClientesExtracaoService(
      llm as unknown as LlmService,
      chatQuota as unknown as ChatQuotaService,
      auditoria as unknown as AuditoriaService,
    );
  });

  it('rejeita arquivo vazio', async () => {
    await expect(
      service.extrairDeArquivo(arquivo({ buffer: Buffer.alloc(0) }), 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita mimetype fora do allowlist', async () => {
    await expect(
      service.extrairDeArquivo(arquivo({ mimetype: 'application/zip' }), 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PDF com texto extraído: chama a IA e devolve dados normalizados', async () => {
    getText.mockResolvedValue({
      text: 'Nome: Fulano de Tal\nCPF: 123.456.789-00'.padEnd(30, ' '),
    });
    llm.extrairDadosEstruturados.mockResolvedValue(
      JSON.stringify({
        nome: 'Fulano de Tal',
        tipo: 'pf',
        cpf: '123.456.789-00',
        cnpj: null,
        nomeFantasia: null,
        rg: '12.345.678-9',
        email: 'fulano@example.com',
        telefone: '(11) 91234-5678',
        endereco: 'Rua das Flores, 100',
        cidade: 'São Paulo',
        uf: 'sp',
        cep: '01234-000',
      }),
    );

    const resultado = await service.extrairDeArquivo(
      arquivo(),
      'u1',
      Role.ADVOGADO,
      { id: 'u1', nome: 'Ana', email: 'ana@alar.com.br' },
    );

    expect(chatQuota.assertPodeUsar).toHaveBeenCalledWith('u1', Role.ADVOGADO);
    expect(llm.extrairDadosEstruturados).toHaveBeenCalled();
    expect(resultado).toEqual(
      expect.objectContaining({
        nome: 'Fulano de Tal',
        tipo: 'PF',
        cpf: '12345678900',
        cnpj: null,
        rg: '12.345.678-9',
        email: 'fulano@example.com',
        telefone: '11912345678',
        endereco: 'Rua das Flores, 100',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01234000',
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'EXTRACAO_IA', entidade: 'CLIENTE' }),
    );
  });

  it('PDF sem camada de texto: devolve aviso e NÃO chama a IA', async () => {
    getText.mockResolvedValue({ text: '  ' });

    const resultado = await service.extrairDeArquivo(arquivo(), 'u1');

    expect(resultado).toEqual({ avisos: ['pdf_sem_texto'] });
    expect(llm.extrairDadosEstruturados).not.toHaveBeenCalled();
    expect(chatQuota.assertPodeUsar).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('imagem: converte para data URL base64 e passa em imagensUrls', async () => {
    llm.extrairDadosEstruturados.mockResolvedValue(
      JSON.stringify({ nome: 'Empresa X', tipo: 'PJ' }),
    );
    const buffer = Buffer.from('fake-image-bytes');

    await service.extrairDeArquivo(
      arquivo({ mimetype: 'image/png', buffer }),
      'u1',
    );

    expect(llm.extrairDadosEstruturados).toHaveBeenCalledWith(
      expect.any(String),
      {
        imagensUrls: [`data:image/png;base64,${buffer.toString('base64')}`],
      },
    );
  });

  it('IA retornando JSON malformado: fallback gracioso sem derrubar a requisição', async () => {
    getText.mockResolvedValue({
      text: 'Documento com texto suficiente para não cair no aviso de PDF sem texto.',
    });
    llm.extrairDadosEstruturados.mockResolvedValue('isto não é JSON válido');

    const resultado = await service.extrairDeArquivo(arquivo(), 'u1');

    expect(resultado).toEqual({ avisos: ['ia_resposta_invalida'] });
    // A tentativa de extração é registrada mesmo quando o parse falha.
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('descarta chaves inesperadas e normaliza tipos incorretos', async () => {
    getText.mockResolvedValue({
      text: 'Documento com texto suficiente para não cair no aviso de PDF sem texto.',
    });
    llm.extrairDadosEstruturados.mockResolvedValue(
      JSON.stringify({
        nome: 123, // tipo errado — deve virar null
        tipo: 'ADVOGADO', // valor inválido — deve virar null
        cpf: 456, // tipo errado — deve virar null
        uf: 'São Paulo', // não são 2 letras — deve virar null
        chaveInesperada: 'não deve aparecer no resultado',
      }),
    );

    const resultado = await service.extrairDeArquivo(arquivo(), 'u1');

    expect(resultado).toEqual(
      expect.objectContaining({
        nome: null,
        tipo: null,
        cpf: null,
        uf: null,
      }),
    );
    expect(resultado).not.toHaveProperty('chaveInesperada');
  });
});
