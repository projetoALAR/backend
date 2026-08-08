import { Test, TestingModule } from '@nestjs/testing';
import { InboxController } from './inbox.controller';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from './notificacoes.service';

describe('InboxController', () => {
  let controller: InboxController;
  const prisma = {
    inboxItem: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    contatoLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const notificacoes = {
    criarInbox: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InboxController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: NotificacoesService, useValue: notificacoes },
      ],
    }).compile();
    controller = module.get(InboxController);
  });

  it('listar filtra por usuário e opcionalmente não lidas', async () => {
    prisma.inboxItem.findMany.mockResolvedValue([]);
    await controller.listar({ id: 'u1' }, 'true');
    expect(prisma.inboxItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: 'u1', lida: false },
      }),
    );
  });

  it('marcarLida atualiza só do usuário', async () => {
    prisma.inboxItem.updateMany.mockResolvedValue({ count: 1 });
    await expect(controller.marcarLida({ id: 'u1' }, 'msg-1')).resolves.toEqual(
      { count: 1 },
    );
    expect(prisma.inboxItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'msg-1', usuarioId: 'u1' },
      data: { lida: true },
    });
  });

  it('marcarTodas marca inbox do usuário', async () => {
    prisma.inboxItem.updateMany.mockResolvedValue({ count: 3 });
    await expect(controller.marcarTodas({ id: 'u1' })).resolves.toEqual({
      count: 3,
    });
  });

  it('registrarContato cria log e inbox', async () => {
    prisma.contatoLog.create.mockResolvedValue({ id: 'c1' });
    notificacoes.criarInbox.mockResolvedValue({});
    await expect(
      controller.registrarContato(
        { id: 'u1' },
        {
          alvoTipo: 'cliente',
          alvoId: 'cli-1',
          alvoNome: 'Cliente',
          canal: 'email',
          destino: 'c@x.com',
        },
      ),
    ).resolves.toEqual({ id: 'c1' });
    expect(notificacoes.criarInbox).toHaveBeenCalled();
  });

  it('listarContatos retorna últimos logs', async () => {
    prisma.contatoLog.findMany.mockResolvedValue([{ id: 'c1' }]);
    await expect(controller.listarContatos({ id: 'u1' })).resolves.toEqual([
      { id: 'c1' },
    ]);
  });
});
