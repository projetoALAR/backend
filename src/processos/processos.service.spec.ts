import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProcessosService } from './processos.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';
import { CreateProcessoDto, UpdateProcessoDto } from './processos.dto';

const CNJ = '0000001-46.2024.8.26.0100';
const CNJ_B = '0000002-41.2024.8.26.0100';

describe('ProcessosService', () => {
  const prisma = {
    processo: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cliente: { findFirst: jest.fn() },
    usuario: { findUnique: jest.fn() },
  };
  const notificacoes = { notificarTodosUsuarios: jest.fn() };
  const casoAcesso = {
    visibilidadeProcesso: jest.fn().mockReturnValue({}),
    assertPodeVer: jest.fn().mockResolvedValue(undefined),
  };
  let service: ProcessosService;
  const user = { id: 'u1', role: Role.ADVOGADO };

  beforeEach(() => {
    jest.clearAllMocks();
    casoAcesso.visibilidadeProcesso.mockReturnValue({});
    service = new ProcessosService(
      prisma as unknown as PrismaService,
      notificacoes as unknown as NotificacoesService,
      casoAcesso as unknown as CasoAcessoService,
    );
  });

  it('cria caso e notifica quando há prazo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1' });
    const criado = {
      id: 'p1',
      titulo: 'Caso',
      numero: CNJ,
      prazo: new Date('2026-09-01'),
    };
    prisma.processo.create.mockResolvedValue(criado);

    await expect(
      service.criar(
        {
          numero: ` ${CNJ} `,
          clienteId: 'c1',
          status: 'Em andamento',
          titulo: 'Caso',
          prazo: '2026-09-01',
          responsavelId: 'u1',
        } satisfies CreateProcessoDto,
        'u1',
      ),
    ).resolves.toEqual(criado);
    expect(notificacoes.notificarTodosUsuarios).toHaveBeenCalled();
  });

  it('cria caso com prazo em modo silencioso sem notificar', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.processo.create.mockResolvedValue({
      id: 'p1',
      titulo: 'Caso',
      numero: CNJ,
      prazo: new Date('2026-09-01'),
    });
    await service.criar(
      {
        numero: CNJ,
        clienteId: 'c1',
        status: 'Em andamento',
        titulo: 'Caso',
        prazo: '2026-09-01',
        responsavelId: 'u1',
      },
      'u1',
      { silencioso: true },
    );
    expect(notificacoes.notificarTodosUsuarios).not.toHaveBeenCalled();
  });

  it('rejeita responsável e co-responsável iguais', async () => {
    await expect(
      service.criar({
        numero: CNJ,
        clienteId: 'c1',
        status: 'Em andamento',
        titulo: 'Caso',
        responsavelId: 'u1',
        coResponsavelId: 'u1',
      } satisfies CreateProcessoDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita usuário da equipe inexistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(
      service.criar({
        numero: CNJ,
        clienteId: 'c1',
        status: 'Em andamento',
        titulo: 'Caso',
        responsavelId: 'ghost',
      } satisfies CreateProcessoDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('busca caso por id com RBAC', async () => {
    const processo = { id: 'p1', titulo: 'Caso' };
    prisma.processo.findUnique.mockResolvedValue(processo);
    await expect(service.buscarPorId('p1', user)).resolves.toEqual(processo);
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(user, 'p1');
  });

  it('lista por cliente e todos usando visibilidade', async () => {
    prisma.processo.findMany.mockResolvedValue([]);
    await expect(service.listarPorCliente('c1', user)).resolves.toEqual([]);
    await expect(service.listarTodos(user)).resolves.toEqual([]);
    expect(casoAcesso.visibilidadeProcesso).toHaveBeenCalledWith(user);
  });

  it('lista processos paginados com total', async () => {
    prisma.processo.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.processo.count = jest.fn().mockResolvedValue(1);
    prisma.$transaction = jest
      .fn()
      .mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));

    await expect(
      service.listarTodos(user, { page: 1, limit: 12, q: 'silva' }),
    ).resolves.toEqual({
      items: [{ id: 'p1' }],
      total: 1,
      page: 1,
      limit: 12,
    });
  });

  it('atualiza numero, prazo e equipe', async () => {
    prisma.processo.findUnique.mockResolvedValue({
      responsavelId: 'u1',
      coResponsavelId: null,
    });
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.processo.update.mockResolvedValue({ id: 'p1' });

    await expect(
      service.atualizar('p1', {
        numero: ` ${CNJ_B} `,
        prazo: null,
        coResponsavelId: 'u2',
      } satisfies UpdateProcessoDto),
    ).resolves.toEqual({ id: 'p1' });
    const updateArg = prisma.processo.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data).toMatchObject({
      numero: CNJ_B,
      tribunalSigla: null,
      prazo: null,
      coResponsavelId: 'u2',
    });
  });

  it('remove o caso', async () => {
    prisma.processo.delete.mockResolvedValue({ id: 'p1' });
    await expect(service.remover('p1')).resolves.toEqual({ id: 'p1' });
  });

  it('importarCsv cria casos do modelo vinculados por CPF/CNPJ', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.cliente.findFirst
      .mockResolvedValueOnce({ id: 'c1', nome: 'Marina' })
      .mockResolvedValueOnce({ id: 'c2', nome: 'Horizonte' });
    prisma.processo.create
      .mockResolvedValueOnce({
        id: 'p1',
        numero: '1004521-38.2025.5.02.0001',
        titulo: 'Reclamação trabalhista — horas extras',
        prazo: null,
      })
      .mockResolvedValueOnce({
        id: 'p2',
        numero: '1018834-72.2026.8.26.0100',
        titulo: 'Cobrança de duplicatas',
        prazo: null,
      });

    const resultado = await service.importarCsv(
      service.modeloCsvImportacao(),
      'u1',
    );
    expect(resultado.criados).toBe(2);
    expect(resultado.erros).toBe(0);
    expect(resultado.duplicados).toBe(0);
    expect(prisma.processo.create).toHaveBeenCalledTimes(2);
    expect(notificacoes.notificarTodosUsuarios).not.toHaveBeenCalled();
  });

  it('importarCsv marca duplicado e cliente ausente sem parar o lote', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.cliente.findFirst
      .mockResolvedValueOnce({ id: 'c1', nome: 'Ana' })
      .mockResolvedValueOnce(null);
    prisma.processo.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const csv = [
      'numero,status,clienteCpf,clienteCnpj',
      '0000001-46.2024.8.26.0100,Em andamento,39053344705,',
      '0000002-41.2024.8.26.0100,Em andamento,,11222333000181',
    ].join('\n');
    const resultado = await service.importarCsv(csv, 'u1');
    expect(resultado.duplicados).toBe(1);
    expect(resultado.erros).toBe(1);
    expect(resultado.criados).toBe(0);
  });
});
