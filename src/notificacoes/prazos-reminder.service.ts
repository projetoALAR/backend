import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from './notificacoes.service';

const JANELAS_PROCESSO = [0, 1, 3, 7] as const;
const JANELAS_COMPROMISSO = [0, 1] as const;

export type PrazosReminderResultado = {
  enviados: number;
  ignorados: number;
};

function inicioDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasAte(data: Date, referencia = new Date()): number {
  const diff =
    inicioDoDia(data).getTime() - inicioDoDia(referencia).getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

function rotuloJanela(dias: number): string {
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

@Injectable()
export class PrazosReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async executar(referencia = new Date()): Promise<PrazosReminderResultado> {
    let enviados = 0;
    let ignorados = 0;

    const processos = await this.prisma.processo.findMany({
      where: {
        concluido: false,
        prazo: { not: null },
      },
      select: {
        id: true,
        titulo: true,
        numero: true,
        prazo: true,
        responsavelId: true,
        coResponsavelId: true,
      },
    });

    for (const processo of processos) {
      if (!processo.prazo) continue;
      const dias = diasAte(processo.prazo, referencia);
      if (!JANELAS_PROCESSO.includes(dias as (typeof JANELAS_PROCESSO)[number])) {
        continue;
      }

      const tituloCaso = processo.titulo || processo.numero;
      const quando = processo.prazo.toLocaleDateString('pt-BR');
      const assunto = `Prazo ${rotuloJanela(dias)}: ${tituloCaso}`;
      const corpo = `O caso ${tituloCaso} vence ${rotuloJanela(dias)} (${quando}).`;
      const link = `/casos/${processo.id}`;
      const destinatarios = await this.resolverDestinatarios(
        processo.responsavelId,
        processo.coResponsavelId,
      );

      for (const usuarioId of destinatarios) {
        const criou = await this.notificacoes.notificarComDedup({
          usuarioId,
          titulo: assunto,
          corpo,
          link,
          tipo: 'prazo-lembrete',
          flag: 'reminders',
        });
        if (criou) enviados += 1;
        else ignorados += 1;
      }
    }

    const compromissos = await this.prisma.compromisso.findMany({
      where: {
        dataHora: { gte: inicioDoDia(referencia) },
      },
      select: {
        id: true,
        titulo: true,
        dataHora: true,
        processoId: true,
        processo: {
          select: {
            responsavelId: true,
            coResponsavelId: true,
          },
        },
      },
    });

    for (const compromisso of compromissos) {
      const dias = diasAte(compromisso.dataHora, referencia);
      if (
        !JANELAS_COMPROMISSO.includes(dias as (typeof JANELAS_COMPROMISSO)[number])
      ) {
        continue;
      }

      const quando = compromisso.dataHora.toLocaleString('pt-BR');
      const assunto = `Compromisso ${rotuloJanela(dias)}: ${compromisso.titulo}`;
      const corpo = `${compromisso.titulo} — ${quando}.`;
      const link = compromisso.processoId
        ? `/casos/${compromisso.processoId}`
        : '/calendar';
      const destinatarios = compromisso.processo
        ? await this.resolverDestinatarios(
            compromisso.processo.responsavelId,
            compromisso.processo.coResponsavelId,
          )
        : await this.todosUsuarios();

      for (const usuarioId of destinatarios) {
        const criou = await this.notificacoes.notificarComDedup({
          usuarioId,
          titulo: assunto,
          corpo,
          link,
          tipo: 'prazo-lembrete',
          flag: 'reminders',
        });
        if (criou) enviados += 1;
        else ignorados += 1;
      }
    }

    return { enviados, ignorados };
  }

  private async resolverDestinatarios(
    responsavelId: string | null | undefined,
    coResponsavelId: string | null | undefined,
  ): Promise<string[]> {
    const ids = [responsavelId, coResponsavelId].filter(
      (id): id is string => Boolean(id),
    );
    if (ids.length > 0) {
      return [...new Set(ids)];
    }
    return this.todosUsuarios();
  }

  private async todosUsuarios(): Promise<string[]> {
    const usuarios = await this.prisma.usuario.findMany({
      select: { id: true },
    });
    return usuarios.map((u) => u.id);
  }
}

export { diasAte, inicioDoDia, rotuloJanela };
