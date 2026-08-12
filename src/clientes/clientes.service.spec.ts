import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';

describe('ClientesService', () => {
  const prisma = {
    cliente: {
      findUnique: jest.fn(),
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
    );
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
});
