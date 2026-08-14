import { NotFoundException } from '@nestjs/common';
import { ProcessosTarefasService } from './processos-tarefas.service';
import { PrismaService } from '../prisma.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('ProcessosTarefasService', () => {
  const processoId = 'p1';
  const user = { id: 'u1', role: Role.ADVOGADO };
  const agora = new Date('2026-08-13T12:00:00Z');

  const prisma = {
    processoTarefa: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const casoAcesso = { assertPodeVer: jest.fn() };
  let service: ProcessosTarefasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProcessosTarefasService(
      prisma as unknown as PrismaService,
      casoAcesso as unknown as CasoAcessoService,
    );
  });

  it('lista tarefas do caso após checar acesso', async () => {
    prisma.processoTarefa.findMany.mockResolvedValue([
      {
        id: 't1',
        processoId,
        titulo: 'Protocolar',
        concluida: false,
        ordem: 0,
        prazo: null,
        criadoPorId: 'u1',
        criadoEm: agora,
        atualizadoEm: agora,
        criadoPor: { id: 'u1', nome: 'Ana', email: 'ana@alar.com.br' },
      },
    ]);
    const lista = await service.listar(processoId, user);
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(user, processoId);
    expect(lista[0]).toMatchObject({
      id: 't1',
      titulo: 'Protocolar',
      prazo: null,
      criadoEm: agora.toISOString(),
    });
  });

  it('cria tarefa no fim da ordem', async () => {
    prisma.processoTarefa.aggregate.mockResolvedValue({ _max: { ordem: 2 } });
    prisma.processoTarefa.create.mockResolvedValue({
      id: 't2',
      processoId,
      titulo: 'Ligar no cliente',
      concluida: false,
      ordem: 3,
      prazo: new Date('2026-08-20'),
      criadoPorId: 'u1',
      criadoEm: agora,
      atualizadoEm: agora,
      criadoPor: { id: 'u1', nome: 'Ana', email: 'ana@alar.com.br' },
    });
    const criada = await service.criar(processoId, user, {
      titulo: '  Ligar no cliente  ',
      prazo: '2026-08-20',
    });
    expect(criada.ordem).toBe(3);
    expect(criada.titulo).toBe('Ligar no cliente');
    expect(prisma.processoTarefa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titulo: 'Ligar no cliente',
          ordem: 3,
          criadoPorId: 'u1',
        }),
      }),
    );
  });

  it('atualiza conclusão e rejeita tarefa de outro caso', async () => {
    prisma.processoTarefa.findFirst.mockResolvedValueOnce({
      id: 't1',
      processoId,
    });
    prisma.processoTarefa.update.mockResolvedValue({
      id: 't1',
      processoId,
      titulo: 'Protocolar',
      concluida: true,
      ordem: 0,
      prazo: null,
      criadoPorId: 'u1',
      criadoEm: agora,
      atualizadoEm: agora,
      criadoPor: null,
    });
    await expect(
      service.atualizar(processoId, 't1', user, { concluida: true }),
    ).resolves.toMatchObject({ concluida: true });

    prisma.processoTarefa.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.atualizar(processoId, 'ghost', user, { concluida: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove tarefa do caso', async () => {
    prisma.processoTarefa.findFirst.mockResolvedValue({
      id: 't1',
      processoId,
    });
    prisma.processoTarefa.delete.mockResolvedValue({
      id: 't1',
      processoId,
      titulo: 'Protocolar',
      concluida: false,
      ordem: 0,
      prazo: null,
      criadoPorId: null,
      criadoEm: agora,
      atualizadoEm: agora,
      criadoPor: null,
    });
    await expect(
      service.remover(processoId, 't1', user),
    ).resolves.toMatchObject({ id: 't1' });
  });
});
