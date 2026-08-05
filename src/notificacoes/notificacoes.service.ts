import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma.service';

type NotificacoesPrefs = {
  email?: boolean;
  push?: boolean;
  reminders?: boolean;
  teamUpdates?: boolean;
};

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT') || 587),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP não configurado — e-mails serão apenas registrados no inbox',
      );
    }
  }

  private async prefsDoUsuario(usuarioId: string): Promise<NotificacoesPrefs> {
    const pref = await this.prisma.preferencia.findUnique({
      where: { usuarioId },
    });
    return (pref?.notificacoes as NotificacoesPrefs) || {};
  }

  async criarInbox(dados: {
    usuarioId: string;
    titulo: string;
    corpo: string;
    tipo?: string;
    link?: string;
  }) {
    return this.prisma.inboxItem.create({
      data: {
        usuarioId: dados.usuarioId,
        titulo: dados.titulo,
        corpo: dados.corpo,
        tipo: dados.tipo || 'sistema',
        link: dados.link,
      },
    });
  }

  async enviarEmailSeAtivo(usuarioId: string, assunto: string, texto: string) {
    const prefs = await this.prefsDoUsuario(usuarioId);
    if (prefs.email === false) {
      return { skipped: true };
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    const to = usuario?.email;
    if (!to) return { skipped: true };

    if (!this.transporter) {
      return { queuedInboxOnly: true };
    }

    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('SMTP_USER') ||
      'noreply@alar.local';

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: assunto,
        text: texto,
      });
      return { sent: true };
    } catch (error) {
      this.logger.error('Falha ao enviar e-mail', error as Error);
      return { sent: false };
    }
  }

  async notificarTodosUsuarios(
    assunto: string,
    texto: string,
    link?: string,
    flag: keyof NotificacoesPrefs = 'reminders',
  ) {
    const usuarios = await this.prisma.usuario.findMany({
      select: { id: true },
    });
    for (const u of usuarios) {
      const prefs = await this.prefsDoUsuario(u.id);
      if (prefs[flag] === false) continue;
      await this.criarInbox({
        usuarioId: u.id,
        titulo: assunto,
        corpo: texto,
        tipo: flag,
        link,
      });
      if (prefs.email !== false) {
        await this.enviarEmailSeAtivo(u.id, assunto, texto);
      }
    }
  }
}
