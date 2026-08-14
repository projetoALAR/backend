import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PeticoesService } from './peticoes.service';
import { PrismaService } from '../prisma.service';
import { ChatContextService } from '../chat/chat-context.service';
import { LlmService } from '../chat/llm.service';
import { DocumentosService } from '../documentos/documentos.service';
import { ChatQuotaService } from '../chat/chat-quota.service';
import { Role } from '../auth/roles';

describe('PeticoesService', () => {
  const prisma = {
    modeloDocumento: { findUnique: jest.fn() },
    processo: { findUnique: jest.fn() },
  };
  const chatContext = {
    montarContextoCaso: jest.fn(),
  };
  const llm = {
    gerarTextoDocumentoComUso: jest.fn(),
  };
  const documentos = {
    criarDocumentoDeTexto: jest.fn(),
  };
  const chatQuota = {
    assertPodeUsar: jest.fn().mockResolvedValue(undefined),
  };

  let service: PeticoesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PeticoesService(
      prisma as unknown as PrismaService,
      chatContext as unknown as ChatContextService,
      llm as unknown as LlmService,
      documentos as unknown as DocumentosService,
      chatQuota as unknown as ChatQuotaService,
    );
  });

  it('gerarRascunho retorna texto da IA com aviso', async () => {
    prisma.modeloDocumento.findUnique.mockResolvedValue({
      id: 'm1',
      nome: 'Petição inicial',
      categoria: 'Petição',
      conteudo: 'Cliente {{cliente.nome}} — processo {{processo.numero}}',
    });
    prisma.processo.findUnique.mockResolvedValue({
      id: 'p1',
      numero: '1000',
      titulo: 'Caso',
      status: 'Em andamento',
      descricao: null,
      cliente: { nome: 'Ana', cpf: '1', email: null, telefone: null },
    });
    chatContext.montarContextoCaso.mockResolvedValue({
      textoContexto: 'contexto do caso',
      imagensUrls: [],
    });
    llm.gerarTextoDocumentoComUso.mockResolvedValue({
      content:
        'Texto expandido do rascunho.\n\nRascunho gerado por IA — revise antes de usar. Não substitui a análise de um advogado habilitado.',
      tokensUsados: 200,
    });

    const result = await service.gerarRascunho('m1', 'p1', 'u1', Role.ADVOGADO);
    expect(result.texto).toContain('Texto expandido');
    expect(result.texto).toContain('Rascunho gerado por IA');
    expect(chatQuota.assertPodeUsar).toHaveBeenCalledWith('u1', Role.ADVOGADO);
    expect(llm.gerarTextoDocumentoComUso).toHaveBeenCalledWith(
      expect.any(String),
      { proposito: 'rascunho' },
    );
    expect(chatContext.montarContextoCaso).toHaveBeenCalledWith('p1');
  });

  it('gerarRascunho lança NotFound se modelo não existe', async () => {
    prisma.modeloDocumento.findUnique.mockResolvedValue(null);
    await expect(
      service.gerarRascunho('m-x', 'p1', 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gerarRascunho lança NotFound se processo não existe', async () => {
    prisma.modeloDocumento.findUnique.mockResolvedValue({
      id: 'm1',
      conteudo: 'x',
      categoria: 'Petição',
    });
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(
      service.gerarRascunho('m1', 'p-x', 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gerarRascunho lança ServiceUnavailable se LLM falhar', async () => {
    prisma.modeloDocumento.findUnique.mockResolvedValue({
      id: 'm1',
      nome: 'X',
      categoria: 'Petição',
      conteudo: 'oi {{cliente.nome}}',
    });
    prisma.processo.findUnique.mockResolvedValue({
      id: 'p1',
      numero: '1',
      titulo: null,
      status: 'Em andamento',
      descricao: null,
      cliente: { nome: 'A', cpf: '1', email: null, telefone: null },
    });
    chatContext.montarContextoCaso.mockResolvedValue({
      textoContexto: 'ctx',
      imagensUrls: [],
    });
    llm.gerarTextoDocumentoComUso.mockResolvedValue({
      content: 'Não consegui obter resposta da IA agora.',
      tokensUsados: 10,
    });

    await expect(
      service.gerarRascunho('m1', 'p1', 'u1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('salvarRascunho delega para DocumentosService', async () => {
    documentos.criarDocumentoDeTexto.mockResolvedValue({ id: 'd1' });
    const doc = await service.salvarRascunho(
      {
        processoId: 'p1',
        nomeArquivo: 'Petição - Caso.pdf',
        texto: 'conteúdo',
        revisaoConfirmada: true,
      },
      'u1',
    );
    expect(doc).toEqual({ id: 'd1' });
    expect(documentos.criarDocumentoDeTexto).toHaveBeenCalledWith(
      'p1',
      'Petição - Caso.pdf',
      'conteúdo',
      { usuarioId: 'u1', em: expect.any(Date) },
    );
  });

  it('salvarRascunho persiste quem revisou e quando (auditoria/LGPD)', async () => {
    documentos.criarDocumentoDeTexto.mockResolvedValue({
      id: 'd2',
      revisadoPorUsuarioId: 'u2',
      revisadoEm: new Date('2026-08-14T18:00:00.000Z'),
    });

    const before = Date.now();
    const doc = await service.salvarRascunho(
      {
        processoId: 'p1',
        nomeArquivo: 'Contestação.pdf',
        texto: 'conteúdo revisado',
        revisaoConfirmada: true,
      },
      'u2',
    );
    const after = Date.now();

    expect(doc).toEqual(
      expect.objectContaining({ id: 'd2', revisadoPorUsuarioId: 'u2' }),
    );
    const revisao = documentos.criarDocumentoDeTexto.mock.calls[0][3] as {
      usuarioId: string;
      em: Date;
    };
    expect(revisao.usuarioId).toBe('u2');
    expect(revisao.em).toBeInstanceOf(Date);
    expect(revisao.em.getTime()).toBeGreaterThanOrEqual(before);
    expect(revisao.em.getTime()).toBeLessThanOrEqual(after);
  });
});
