import { NotFoundException } from '@nestjs/common';
import { ChatContextService } from './chat-context.service';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';

describe('ChatContextService', () => {
  const prisma = {
    cliente: { count: jest.fn() },
    processo: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    membroEquipe: { count: jest.fn() },
    andamento: { findMany: jest.fn() },
  };

  const documentos = {
    resolveSignedUrl: jest.fn(),
  };

  let service: ChatContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatContextService(
      prisma as unknown as PrismaService,
      documentos as unknown as DocumentosService,
    );
  });

  it('montarContexto agrega totais sem detalhes sensíveis', async () => {
    prisma.cliente.count.mockResolvedValue(3);
    prisma.processo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(6);
    prisma.processo.groupBy
      .mockResolvedValueOnce([
        { status: 'Em andamento', _count: { status: 6 } },
      ])
      .mockResolvedValueOnce([
        { prioridade: 'Alta', _count: { prioridade: 2 } },
      ]);
    prisma.membroEquipe.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    prisma.processo.findMany
      .mockResolvedValueOnce([
        { numero: '1', titulo: 'Caso A', status: 'Em andamento' },
      ])
      .mockResolvedValueOnce([]);

    const texto = await service.montarContexto();
    expect(texto).toContain('Clientes cadastrados (quantidade): 3');
    expect(texto).toContain('Casos ATIVOS: 6');
    expect(texto).toContain('Caso A');
    expect(texto).toContain('PRIVACIDADE');
    expect(texto).not.toContain('descrição do caso:');
  });

  it('montarContextoCaso lança NotFound quando processo não existe', async () => {
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(service.montarContextoCaso('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('montarContextoCaso inclui dados do processo e cliente', async () => {
    prisma.processo.findUnique.mockResolvedValue({
      id: 'p1',
      numero: '1000123-45.2024.8.26.0100',
      titulo: 'Caso teste',
      status: 'Em andamento',
      concluido: false,
      prioridade: 'Média',
      prazo: null,
      descricao: 'Objeto do caso',
      tags: ['civil'],
      criadoEm: new Date('2024-01-01'),
      atualizadoEm: new Date('2024-01-02'),
      cliente: {
        nome: 'Cliente X',
        cpf: '000',
        email: null,
        telefone: null,
      },
      compromissos: [],
      documentos: [],
      _count: { documentos: 0, compromissos: 0 },
    });
    prisma.andamento.findMany.mockResolvedValue([
      {
        data: new Date('2024-02-01'),
        descricao: 'Distribuição',
      },
    ]);

    const resultado = await service.montarContextoCaso('p1');
    expect(resultado.textoContexto).toContain('Caso teste');
    expect(resultado.textoContexto).toContain('Cliente X');
    expect(resultado.textoContexto).toContain('Objeto do caso');
    expect(resultado.textoContexto).toContain('## Andamentos recentes');
    expect(resultado.textoContexto).toContain('Distribuição');
    expect(resultado.imagensUrls).toEqual([]);
    expect(resultado.fontes).toEqual([]);
    expect(prisma.andamento.findMany).toHaveBeenCalledWith({
      where: { processoId: 'p1' },
      orderBy: { data: 'desc' },
      take: 20,
      select: { data: true, descricao: true },
    });
  });
});
