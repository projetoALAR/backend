import { NotFoundException } from '@nestjs/common';
import { AndamentosService } from './andamentos.service';
import { AndamentosProvider } from './andamentos-provider';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

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
      update: jest.fn(),
    },
    andamento: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const provider: AndamentosProvider = {
    consultarPorNumero: jest.fn(),
  };

  const notificacoes = {
    notificarTodosUsuarios: jest.fn(),
  };

  let service: AndamentosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AndamentosService(
      prisma as unknown as PrismaService,
      provider,
      notificacoes as unknown as NotificacoesService,
    );
  });

  it('listarPorProcesso lança NotFound quando processo não existe', async () => {
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(service.listarPorProcesso('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('listarPorProcesso retorna andamentos ordenados pelo service Prisma', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'proc-1' });
    prisma.andamento.findMany.mockResolvedValue([{ id: 'a1' }]);

    const lista = await service.listarPorProcesso('proc-1');
    expect(lista).toEqual([{ id: 'a1' }]);
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
      '/tasks?caseId=proc-1',
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
    expect(resultado.motivo).toBe('não achou');
    expect(prisma.andamento.create).not.toHaveBeenCalled();
    expect(notificacoes.notificarTodosUsuarios).not.toHaveBeenCalled();
  });
});
