import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AndamentosService } from './andamentos.service';
import { AndamentosProvider } from './andamentos-provider';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('AndamentosService', () => {
  const processo = {
    id: 'proc-1',
    numero: '1000123-45.2024.8.26.0100',
    titulo: 'Caso teste',
    tribunalSigla: null as string | null,
    concluido: false,
  };

  const prisma = {
    processo: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    andamento: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const provider: AndamentosProvider = {
    consultarPorNumero: jest.fn(),
  };

  const notificacoes = {
    notificarTodosUsuarios: jest.fn(),
  };
  const casoAcesso = {
    visibilidadeProcesso: jest.fn().mockReturnValue({}),
  };

  let service: AndamentosService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.processo.update.mockResolvedValue({});
    service = new AndamentosService(
      prisma as unknown as PrismaService,
      provider,
      notificacoes as unknown as NotificacoesService,
      casoAcesso as unknown as CasoAcessoService,
    );
  });

  it('listarPorProcesso lança NotFound quando processo não existe', async () => {
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(service.listarPorProcesso('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('listarPorProcesso retorna andamentos com explicacao do glossário', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'proc-1' });
    prisma.andamento.findMany.mockResolvedValue([
      {
        id: 'a1',
        codigoMovimento: 26,
        descricao: 'Distribuição',
      },
      {
        id: 'a2',
        codigoMovimento: 999999,
        descricao: 'Movimento raro',
      },
    ]);

    const lista = await service.listarPorProcesso('proc-1');
    expect(lista[0].explicacao).toMatch(/vara/i);
    expect(lista[1].explicacao).toBeNull();
    expect(prisma.andamento.findMany).toHaveBeenCalledWith({
      where: { processoId: 'proc-1' },
      orderBy: { data: 'desc' },
    });
  });

  it('sincronizarProcesso insere só andamentos novos e notifica', async () => {
    const dataExistente = new Date('2024-01-10T12:00:00.000Z');
    const dataNova = new Date('2024-02-01T15:30:00.000Z');

    prisma.processo.findUnique.mockResolvedValue(processo);
    (provider.consultarPorNumero as jest.Mock).mockResolvedValue({
      ok: true,
      tribunalSigla: 'tjsp',
      movimentos: [
        {
          codigoMovimento: 26,
          descricao: 'Distribuído',
          data: dataExistente,
          origem: { codigo: 26, nome: 'Distribuído' },
        },
        {
          codigoMovimento: 123,
          descricao: 'Juntada de petição',
          data: dataNova,
          origem: { codigo: 123, nome: 'Juntada de petição' },
        },
      ],
    });
    prisma.processo.update.mockResolvedValue({
      ...processo,
      tribunalSigla: 'tjsp',
    });
    prisma.andamento.findMany.mockResolvedValue([
      {
        data: dataExistente,
        descricao: 'Distribuído',
        codigoMovimento: 26,
      },
    ]);
    prisma.andamento.create.mockResolvedValue({ id: 'novo' });
    notificacoes.notificarTodosUsuarios.mockResolvedValue(undefined);

    const resultado = await service.sincronizarProcesso('proc-1');

    expect(resultado.inseridos).toBe(1);
    expect(resultado.ok).toBe(true);
    expect(resultado.totalNaFonte).toBe(2);
    expect(resultado.tribunalSigla).toBe('tjsp');
    expect(prisma.andamento.create).toHaveBeenCalledTimes(1);
    const calls = prisma.andamento.create.mock.calls as Array<
      [
        {
          data: {
            processoId: string;
            descricao: string;
            codigoMovimento: number;
          };
        },
      ]
    >;
    const createArg = calls[0][0];
    expect(createArg.data.processoId).toBe('proc-1');
    expect(createArg.data.descricao).toBe('Juntada de petição');
    expect(createArg.data.codigoMovimento).toBe(123);
    expect(notificacoes.notificarTodosUsuarios).toHaveBeenCalledWith(
      'Novo andamento processual',
      expect.stringContaining('Juntada de petição'),
      '/casos/proc-1',
      'reminders',
      'andamento',
    );
  });

  it('sincronizarProcesso não cria quando provider não encontra processo', async () => {
    prisma.processo.findUnique.mockResolvedValue(processo);
    (provider.consultarPorNumero as jest.Mock).mockResolvedValue({
      ok: false,
      motivo: 'nao_encontrado',
      mensagem: 'não achou',
    });

    const resultado = await service.sincronizarProcesso('proc-1');
    expect(resultado.inseridos).toBe(0);
    expect(resultado.ok).toBe(false);
    expect(resultado.status).toBe('nao_encontrado');
    expect(resultado.motivo).toMatch(/não encontrado/i);
    expect(prisma.andamento.create).not.toHaveBeenCalled();
    expect(notificacoes.notificarTodosUsuarios).not.toHaveBeenCalled();
    expect(prisma.processo.update).toHaveBeenCalled();
  });

  it('consultarPublico devolve movimentos sem gravar', async () => {
    (provider.consultarPorNumero as jest.Mock).mockResolvedValue({
      ok: true,
      tribunalSigla: 'tjsp',
      movimentos: [
        {
          codigoMovimento: 26,
          descricao: 'Distribuído',
          data: new Date('2024-01-10T12:00:00.000Z'),
          origem: {},
        },
      ],
    });
    prisma.processo.findFirst.mockResolvedValue({
      id: 'proc-1',
      titulo: 'Caso teste',
      numero: '1000123-45.2024.8.26.0100',
    });

    const resultado = await service.consultarPublico(
      '1000123-45.2024.8.26.0100',
      { id: 'u1', role: Role.ADVOGADO },
    );
    expect(resultado.ok).toBe(true);
    expect(resultado.movimentos).toHaveLength(1);
    expect(resultado.tribunalNome).toBe('TJSP');
    expect(resultado.caso?.id).toBe('proc-1');
    expect(prisma.andamento.create).not.toHaveBeenCalled();
  });

  it('criarManual persiste origem da equipe sem notificar', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'proc-1' });
    const criado = {
      id: 'a-manual',
      descricao: 'Protocolado',
      codigoMovimento: null,
      origem: { tipo: 'manual' },
    };
    prisma.andamento.create.mockResolvedValue(criado);

    const res = await service.criarManual(
      'proc-1',
      { descricao: '  Protocolado  ', data: '2026-08-13' },
      'u1',
    );
    expect(res.manual).toBe(true);
    expect(prisma.andamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processoId: 'proc-1',
          descricao: 'Protocolado',
          origem: { tipo: 'manual', usuarioId: 'u1' },
        }),
      }),
    );
    expect(notificacoes.notificarTodosUsuarios).not.toHaveBeenCalled();
  });

  it('criarManual rejeita descrição vazia', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'proc-1' });
    await expect(
      service.criarManual('proc-1', { descricao: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removerManual só apaga lançamento da equipe', async () => {
    prisma.andamento.findFirst.mockResolvedValue({
      id: 'a1',
      descricao: 'Protocolado',
      codigoMovimento: null,
      origem: { tipo: 'manual' },
    });
    prisma.andamento.delete.mockResolvedValue({});
    await expect(service.removerManual('proc-1', 'a1')).resolves.toMatchObject({
      id: 'a1',
      manual: true,
    });
    expect(prisma.andamento.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });

  it('removerManual bloqueia andamento do tribunal', async () => {
    prisma.andamento.findFirst.mockResolvedValue({
      id: 'a1',
      origem: { codigo: 26 },
    });
    await expect(service.removerManual('proc-1', 'a1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.andamento.delete).not.toHaveBeenCalled();
  });
});
