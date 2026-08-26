import { ConfigService } from '@nestjs/config';
import { NotificacoesService } from './notificacoes.service';
import { PrismaService } from '../prisma.service';

const sendMail = jest.fn();
const getTestMessageUrl = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
  getTestMessageUrl: (...args: unknown[]) => getTestMessageUrl(...args),
}));

function criarConfig(valores: Record<string, string> = {}): ConfigService {
  return { get: (key: string) => valores[key] } as unknown as ConfigService;
}

describe('NotificacoesService', () => {
  const prisma = {
    preferencia: { findUnique: jest.fn() },
    usuario: { findUnique: jest.fn(), findMany: jest.fn() },
    inboxItem: { create: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sem SMTP configurado', () => {
    function criarServico() {
      return new NotificacoesService(
        prisma as unknown as PrismaService,
        criarConfig({}),
      );
    }

    it('criarInbox grava item com tipo padrão "sistema"', async () => {
      prisma.inboxItem.create.mockResolvedValue({ id: 'i1' });
      await criarServico().criarInbox({
        usuarioId: 'u1',
        titulo: 'Título',
        corpo: 'Corpo',
      });
      expect(prisma.inboxItem.create).toHaveBeenCalledWith({
        data: {
          usuarioId: 'u1',
          titulo: 'Título',
          corpo: 'Corpo',
          tipo: 'sistema',
          link: undefined,
        },
      });
    });

    it('enviarEmailSeAtivo apenas enfileira no inbox (sem transporter)', async () => {
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.usuario.findUnique.mockResolvedValue({ email: 'a@alar.com.br' });

      await expect(
        criarServico().enviarEmailSeAtivo('u1', 'Assunto', 'Texto'),
      ).resolves.toEqual({ queuedInboxOnly: true });
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('enviarEmailTransacional devolve devPreviewLink fora de production', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        await expect(
          criarServico().enviarEmailTransacional({
            para: 'a@alar.com.br',
            assunto: 'Reset',
            titulo: 'Reset',
            corpo: 'Corpo',
            link: 'http://localhost:3000/redefinir-senha?token=abc',
          }),
        ).resolves.toEqual({
          queuedInboxOnly: true,
          devPreviewLink: 'http://localhost:3000/redefinir-senha?token=abc',
        });
      } finally {
        process.env.NODE_ENV = prev;
      }
    });

    it('statusEmail reporta smtpConfigured=false sem transporter', () => {
      expect(criarServico().statusEmail()).toEqual(
        expect.objectContaining({
          smtpConfigured: false,
          smtpHost: null,
          appUrl: 'http://localhost:3000',
        }),
      );
    });

    it('enviarEmailTeste sem SMTP devolve queuedInboxOnly', async () => {
      await expect(
        criarServico().enviarEmailTeste('admin@alar.com.br'),
      ).resolves.toEqual(
        expect.objectContaining({
          queuedInboxOnly: true,
          para: 'admin@alar.com.br',
        }),
      );
    });

    it('enviarEmailSeAtivo pula quando a preferência de e-mail está desativada', async () => {
      prisma.preferencia.findUnique.mockResolvedValue({
        notificacoes: { email: false },
      });

      await expect(
        criarServico().enviarEmailSeAtivo('u1', 'Assunto', 'Texto'),
      ).resolves.toEqual({ skipped: true });
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('enviarEmailSeAtivo pula quando o usuário não tem e-mail', async () => {
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        criarServico().enviarEmailSeAtivo('u1', 'Assunto', 'Texto'),
      ).resolves.toEqual({ skipped: true });
    });

    it('notificarUsuario não cria inbox quando a flag da preferência está desativada', async () => {
      prisma.preferencia.findUnique.mockResolvedValue({
        notificacoes: { reminders: false },
      });

      await criarServico().notificarUsuario('u1', 'Assunto', 'Texto');
      expect(prisma.inboxItem.create).not.toHaveBeenCalled();
    });

    it('notificarUsuario cria inbox quando a flag está ativa (padrão)', async () => {
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.inboxItem.create.mockResolvedValue({ id: 'i1' });
      prisma.usuario.findUnique.mockResolvedValue({ email: 'a@alar.com.br' });

      await criarServico().notificarUsuario('u1', 'Assunto', 'Texto');
      expect(prisma.inboxItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ usuarioId: 'u1', tipo: 'reminders' }),
        }),
      );
    });

    it('notificarTodosUsuarios notifica cada usuário cadastrado', async () => {
      prisma.usuario.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.inboxItem.create.mockResolvedValue({ id: 'i1' });
      prisma.usuario.findUnique.mockResolvedValue({ email: 'a@alar.com.br' });

      await criarServico().notificarTodosUsuarios('Assunto', 'Texto');
      expect(prisma.inboxItem.create).toHaveBeenCalledTimes(2);
    });

    it('notificarComDedup não duplica lembrete já enviado no mesmo dia', async () => {
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.inboxItem.findFirst.mockResolvedValue({ id: 'existente' });

      const criado = await criarServico().notificarComDedup({
        usuarioId: 'u1',
        titulo: 'Prazo',
        corpo: 'Vence amanhã',
      });
      expect(criado).toBe(false);
      expect(prisma.inboxItem.create).not.toHaveBeenCalled();
    });

    it('notificarComDedup cria quando ainda não notificou hoje', async () => {
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.inboxItem.findFirst.mockResolvedValue(null);
      prisma.inboxItem.create.mockResolvedValue({ id: 'novo' });
      prisma.usuario.findUnique.mockResolvedValue({ email: 'a@alar.com.br' });

      const criado = await criarServico().notificarComDedup({
        usuarioId: 'u1',
        titulo: 'Prazo',
        corpo: 'Vence amanhã',
      });
      expect(criado).toBe(true);
      expect(prisma.inboxItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            usuarioId: 'u1',
            tipo: 'prazo-lembrete',
          }),
        }),
      );
    });

    it('notificarComDedup respeita a flag desativada', async () => {
      prisma.preferencia.findUnique.mockResolvedValue({
        notificacoes: { reminders: false },
      });

      const criado = await criarServico().notificarComDedup({
        usuarioId: 'u1',
        titulo: 'Prazo',
        corpo: 'Vence amanhã',
      });
      expect(criado).toBe(false);
      expect(prisma.inboxItem.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('com SMTP configurado', () => {
    function criarServico() {
      return new NotificacoesService(
        prisma as unknown as PrismaService,
        criarConfig({
          SMTP_HOST: 'smtp.exemplo.com',
          SMTP_USER: 'user',
          SMTP_PASS: 'pass',
        }),
      );
    }

    it('envia e-mail via transporter quando ativo', async () => {
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.usuario.findUnique.mockResolvedValue({ email: 'a@alar.com.br' });
      sendMail.mockResolvedValue({});
      getTestMessageUrl.mockReturnValue(false);

      await expect(
        criarServico().enviarEmailSeAtivo('u1', 'Assunto', 'Texto'),
      ).resolves.toEqual({ sent: true });
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@alar.com.br' }),
      );
    });

    it('inclui etherealPreviewUrl quando o transporte é Ethereal', async () => {
      sendMail.mockResolvedValue({ messageId: 'x' });
      getTestMessageUrl.mockReturnValue('https://ethereal.email/message/abc');

      await expect(
        criarServico().enviarEmailTeste('admin@alar.com.br'),
      ).resolves.toEqual({
        sent: true,
        etherealPreviewUrl: 'https://ethereal.email/message/abc',
        para: 'admin@alar.com.br',
      });
    });

    it('devolve sent:false quando o transporter falha', async () => {
      prisma.preferencia.findUnique.mockResolvedValue(null);
      prisma.usuario.findUnique.mockResolvedValue({ email: 'a@alar.com.br' });
      sendMail.mockRejectedValue(new Error('smtp indisponível'));

      await expect(
        criarServico().enviarEmailSeAtivo('u1', 'Assunto', 'Texto'),
      ).resolves.toEqual({ sent: false });
    });
  });
});
