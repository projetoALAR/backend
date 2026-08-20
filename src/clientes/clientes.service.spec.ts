import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';

describe('ClientesService', () => {
  const prisma = {
    cliente: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    documento: { findMany: jest.fn() },
    conversacao: { deleteMany: jest.fn() },
  };
  const documentos = { remover: jest.fn() };
  let service: ClientesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientesService(
      prisma as unknown as PrismaService,
      documentos as unknown as DocumentosService,
      {
        visibilidadeCliente: jest.fn().mockReturnValue({}),
      } as unknown as CasoAcessoService,
    );
  });

  it('cria pessoa física exigindo CPF', async () => {
    prisma.cliente.create.mockResolvedValue({ id: 'c1', tipo: 'PF' });
    await expect(
      service.criar({ nome: 'Ana', cpf: '123.456.789-01' }),
    ).resolves.toEqual({ id: 'c1', tipo: 'PF' });
    expect(prisma.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'PF',
          cpf: '12345678901',
          cnpj: null,
        }),
      }),
    );
  });

  it('cria pessoa jurídica exigindo CNPJ', async () => {
    prisma.cliente.create.mockResolvedValue({ id: 'c2', tipo: 'PJ' });
    await expect(
      service.criar({
        nome: 'Escritório X',
        tipo: 'PJ',
        cnpj: '12.345.678/0001-99',
      }),
    ).resolves.toEqual({ id: 'c2', tipo: 'PJ' });
    expect(prisma.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'PJ',
          cpf: null,
          cnpj: '12345678000199',
        }),
      }),
    );
  });

  it('rejeita PF sem CPF válido', async () => {
    await expect(service.criar({ nome: 'Ana', cpf: '123' })).rejects.toThrow(
      'CPF deve ter 11 dígitos',
    );
  });

  it('buscarPorId devolve o cliente visível', async () => {
    prisma.cliente.findFirst.mockResolvedValue({
      id: 'c1',
      nome: 'Ana',
      _count: { processos: 2 },
    });
    await expect(
      service.buscarPorId('c1', { id: 'u1', role: 'ADVOGADO' } as never),
    ).resolves.toEqual({
      id: 'c1',
      nome: 'Ana',
      _count: { processos: 2 },
    });
  });

  it('buscarPorId lança 404 se o cliente não existe', async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);
    await expect(
      service.buscarPorId('c1', { id: 'u1', role: 'ADVOGADO' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exportar lança 404 se o cliente não existe', async () => {
    prisma.cliente.findUnique.mockResolvedValue(null);
    await expect(service.exportar('c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exportar devolve cliente e processos', async () => {
    prisma.cliente.findUnique.mockResolvedValue({
      id: 'c1',
      nome: 'Ana',
      cpf: '12345678901',
      email: 'ana@a.com',
      telefone: '11',
      criadoEm: new Date('2026-01-01'),
      processos: [],
    });
    const result = await service.exportar('c1');
    expect(result.origem).toBe('Alar');
    expect(result.cliente.nome).toBe('Ana');
    expect(result.processos).toEqual([]);
  });

  it('anonimizar rejeita cliente já anonimizado', async () => {
    prisma.cliente.findUnique.mockResolvedValue({
      id: 'c1',
      nome: 'Titular anonimizado',
      cpf: 'ANON123',
      processos: [],
    });
    await expect(service.anonimizar('c1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('anonimizar apaga docs/chats e mascara PII', async () => {
    prisma.cliente.findUnique.mockResolvedValue({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      nome: 'Ana',
      cpf: '12345678901',
      processos: [{ id: 'p1' }],
    });
    prisma.documento.findMany.mockResolvedValue([{ id: 'd1' }]);
    documentos.remover.mockResolvedValue({});
    prisma.conversacao.deleteMany.mockResolvedValue({ count: 1 });
    prisma.cliente.update.mockResolvedValue({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      nome: 'Titular anonimizado',
      cpf: 'ANONaaaaaaaaa',
      email: null,
      telefone: null,
      _count: { processos: 1 },
    });

    const result = await service.anonimizar(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
    expect(documentos.remover).toHaveBeenCalledWith('d1');
    expect(prisma.conversacao.deleteMany).toHaveBeenCalled();
    expect(result.nome).toBe('Titular anonimizado');
    expect(prisma.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: null,
          telefone: null,
        }),
      }),
    );
  });

  it('importarCsv cria PF e PJ do modelo', async () => {
    prisma.cliente.create
      .mockResolvedValueOnce({ id: 'c1', nome: 'Marina Souza Lima' })
      .mockResolvedValueOnce({ id: 'c2', nome: 'Horizonte Atacado Ltda' });

    const resultado = await service.importarCsv(service.modeloCsv());
    expect(resultado.criados).toBe(2);
    expect(resultado.erros).toBe(0);
    expect(resultado.duplicados).toBe(0);
    expect(prisma.cliente.create).toHaveBeenCalledTimes(2);
  });

  it('importarCsv marca duplicado no banco sem parar o lote', async () => {
    prisma.cliente.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValueOnce({ id: 'c2', nome: 'Beta Ltda' });

    const csv = [
      'nome,tipo,cpf,cnpj',
      'Ana,PF,12345678901,',
      'Beta Ltda,PJ,,12345678000199',
    ].join('\n');
    const resultado = await service.importarCsv(csv);
    expect(resultado.duplicados).toBe(1);
    expect(resultado.criados).toBe(1);
    expect(resultado.erros).toBe(0);
  });
});
