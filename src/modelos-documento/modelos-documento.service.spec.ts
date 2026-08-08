import { NotFoundException } from '@nestjs/common';
import { ModelosDocumentoService } from './modelos-documento.service';
import { PrismaService } from '../prisma.service';

describe('ModelosDocumentoService', () => {
  const prisma = {
    modeloDocumento: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    processo: {
      findUnique: jest.fn(),
    },
  };

  let service: ModelosDocumentoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModelosDocumentoService(prisma as unknown as PrismaService);
  });

  it('criar persiste nome/categoria/conteudo', async () => {
    prisma.modeloDocumento.create.mockResolvedValue({ id: 'm1' });
    await service.criar({
      nome: '  Petição inicial  ',
      categoria: 'Petição',
      conteudo: 'Olá {{cliente.nome}}',
    });
    expect(prisma.modeloDocumento.create).toHaveBeenCalledWith({
      data: {
        nome: 'Petição inicial',
        categoria: 'Petição',
        conteudo: 'Olá {{cliente.nome}}',
      },
    });
  });

  it('listarTodos filtra por categoria quando informada', async () => {
    prisma.modeloDocumento.findMany.mockResolvedValue([]);
    await service.listarTodos('Contrato');
    expect(prisma.modeloDocumento.findMany).toHaveBeenCalledWith({
      where: { categoria: 'Contrato' },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
  });

  it('buscarPorId lança NotFound quando ausente', async () => {
    prisma.modeloDocumento.findUnique.mockResolvedValue(null);
    await expect(service.buscarPorId('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('previsualizar preenche placeholders e marca pendências', async () => {
    prisma.modeloDocumento.findUnique.mockResolvedValue({
      id: 'm1',
      nome: 'Procuração',
      conteudo:
        'Eu, {{cliente.nome}}, CPF {{cliente.cpf}}, tel {{cliente.telefone}}, processo {{processo.numero}}.',
    });
    prisma.processo.findUnique.mockResolvedValue({
      id: 'p1',
      numero: '1000',
      titulo: 'Caso X',
      status: 'Em andamento',
      descricao: null,
      cliente: {
        nome: 'Ana',
        cpf: '111.222.333-44',
        email: null,
        telefone: null,
      },
    });

    const preview = await service.previsualizar('m1', 'p1');
    expect(preview.texto).toContain('Ana');
    expect(preview.texto).toContain('111.222.333-44');
    expect(preview.texto).toContain('[PENDENTE: cliente.telefone]');
    expect(preview.texto).toContain('1000');
    expect(preview.modeloNome).toBe('Procuração');
  });

  it('previsualizar lança NotFound se processo não existe', async () => {
    prisma.modeloDocumento.findUnique.mockResolvedValue({
      id: 'm1',
      nome: 'X',
      conteudo: 'a',
    });
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(service.previsualizar('m1', 'p-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
