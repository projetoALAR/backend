import { BadRequestException } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';
import { CreateProcessoDto, UpdateProcessoDto } from './processos.dto';

describe('ProcessosService', () => {
  const prisma = {
    processo: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
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
      numero: '1',
      prazo: new Date('2026-09-01'),
    };
    prisma.processo.create.mockResolvedValue(criado);

    await expect(
      service.criar(
        {
          numero: ' 1 ',
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

  it('rejeita responsável e co-responsável iguais', async () => {
    await expect(
      service.criar({
        numero: '1',
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
        numero: '1',
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

  it('atualiza numero, prazo e equipe', async () => {
    prisma.processo.findUnique.mockResolvedValue({
      responsavelId: 'u1',
      coResponsavelId: null,
    });
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.processo.update.mockResolvedValue({ id: 'p1' });

    await expect(
      service.atualizar('p1', {
        numero: ' 99 ',
        prazo: null,
        coResponsavelId: 'u2',
      } satisfies UpdateProcessoDto),
    ).resolves.toEqual({ id: 'p1' });
    const updateArg = prisma.processo.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data).toMatchObject({
      numero: '99',
      tribunalSigla: null,
      prazo: null,
      coResponsavelId: 'u2',
    });
  });

  it('remove o caso', async () => {
    prisma.processo.delete.mockResolvedValue({ id: 'p1' });
    await expect(service.remover('p1')).resolves.toEqual({ id: 'p1' });
  });
});
