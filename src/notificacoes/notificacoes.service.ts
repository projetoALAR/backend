import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma.service';
import { montarEmailAlar } from './email-template';

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

  private appUrl(): string {
    return (
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('CORS_ORIGINS')?.split(',')[0]?.trim() ||
      'http://localhost:3000'
    );
  }

  async enviarEmailSeAtivo(
    usuarioId: string,
    assunto: string,
    texto: string,
    link?: string,
  ) {
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

    const { html, text } = montarEmailAlar({
      titulo: assunto,
      corpo: texto,
      link,
      appUrl: this.appUrl(),
    });

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: `[Alar] ${assunto}`,
        text,
        html,
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
    /** Tipo do InboxItem; padrão = flag de preferência */
    tipo?: string,
  ) {
    const usuarios = await this.prisma.usuario.findMany({
      select: { id: true },
    });
    for (const u of usuarios) {
      await this.notificarUsuario(u.id, assunto, texto, link, flag, tipo);
    }
  }

  async notificarUsuario(
    usuarioId: string,
    assunto: string,
    texto: string,
    link?: string,
    flag: keyof NotificacoesPrefs = 'reminders',
    tipo?: string,
  ) {
    const prefs = await this.prefsDoUsuario(usuarioId);
    if (prefs[flag] === false) return;

    await this.criarInbox({
      usuarioId,
      titulo: assunto,
      corpo: texto,
      tipo: tipo || flag,
      link,
    });

    if (prefs.email !== false) {
      await this.enviarEmailSeAtivo(usuarioId, assunto, texto, link);
    }
  }

  /** Evita duplicar lembrete no mesmo dia. */
  async notificarComDedup(dados: {
    usuarioId: string;
    titulo: string;
    corpo: string;
    link?: string;
    tipo?: string;
    flag?: keyof NotificacoesPrefs;
  }): Promise<boolean> {
    const prefs = await this.prefsDoUsuario(dados.usuarioId);
    const flag = dados.flag ?? 'reminders';
    if (prefs[flag] === false) return false;

    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);

    const existente = await this.prisma.inboxItem.findFirst({
      where: {
        usuarioId: dados.usuarioId,
        titulo: dados.titulo,
        tipo: dados.tipo || 'prazo-lembrete',
        criadoEm: { gte: inicio },
      },
      select: { id: true },
    });
    if (existente) return false;

    await this.criarInbox({
      usuarioId: dados.usuarioId,
      titulo: dados.titulo,
      corpo: dados.corpo,
      tipo: dados.tipo || 'prazo-lembrete',
      link: dados.link,
    });

    if (prefs.email !== false) {
      await this.enviarEmailSeAtivo(
        dados.usuarioId,
        dados.titulo,
        dados.corpo,
        dados.link,
      );
    }

    return true;
  }
}
