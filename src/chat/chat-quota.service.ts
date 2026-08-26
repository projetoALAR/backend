import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { Role } from '../auth/roles';
import { BillingService } from '../billing/billing.service';

export type ChatQuotaResumo = {
  usados: number;
  limite: number;
  restantes: number;
};

@Injectable()
export class ChatQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
  ) {}

  /** Fallback por role quando não há plano ativo (dev). */
  limiteDiarioFallback(role?: Role): number {
    if (role === Role.ADMIN) {
      return Number(
        this.config.get<string>('CHAT_DAILY_TOKEN_LIMIT_ADMIN') || 500_000,
      );
    }
    return Number(this.config.get<string>('CHAT_DAILY_TOKEN_LIMIT') || 100_000);
  }

  async limiteDiario(usuarioId: string, role?: Role): Promise<number> {
    const doPlano = await this.billing.tokensDiaDoUsuario(usuarioId);
    if (doPlano != null) return doPlano;
    return this.limiteDiarioFallback(role);
  }

  inicioDoDia(): Date {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }

  async obterUsoDiario(usuarioId: string): Promise<number> {
    const agg = await this.prisma.mensagem.aggregate({
      where: {
        isUser: false,
        tokensUsados: { not: null },
        criadoEm: { gte: this.inicioDoDia() },
        conversacao: { usuarioId },
      },
      _sum: { tokensUsados: true },
    });
    return agg._sum.tokensUsados ?? 0;
  }

  async resumo(usuarioId: string, role?: Role): Promise<ChatQuotaResumo> {
    const usados = await this.obterUsoDiario(usuarioId);
    const limite = await this.limiteDiario(usuarioId, role);
    return {
      usados,
      limite,
      restantes: Math.max(0, limite - usados),
    };
  }

  async assertPodeUsar(
    usuarioId: string,
    role?: Role,
    tokensEstimados = 2_000,
  ): Promise<void> {
    const { usados, limite } = await this.resumo(usuarioId, role);
    if (usados + tokensEstimados > limite) {
      throw new HttpException(
        {
          message: `Limite diário de uso da IA atingido (${usados.toLocaleString('pt-BR')} / ${limite.toLocaleString('pt-BR')} tokens). Tente novamente amanhã.`,
          usados,
          limite,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async registrarFeedback(
    mensagemId: string,
    usuarioId: string,
    util: boolean,
    motivo?: string,
  ) {
    const mensagem = await this.prisma.mensagem.findUnique({
      where: { id: mensagemId },
      include: { conversacao: { select: { usuarioId: true } } },
    });
    if (!mensagem || mensagem.isUser) {
      throw new NotFoundException('Mensagem não encontrada.');
    }
    if (mensagem.conversacao.usuarioId !== usuarioId) {
      throw new ForbiddenException('Você não pode avaliar esta mensagem.');
    }

    const motivoLimpo = motivo?.trim() || null;
    return this.prisma.mensagem.update({
      where: { id: mensagemId },
      data: {
        feedback: util ? 'util' : 'nao_util',
        feedbackMotivo: util ? null : motivoLimpo,
      },
    });
  }

  async metricasAdmin(): Promise<{
    dia: string;
    tokensTotal: number;
    mensagensIa: number;
    feedbackUtil: number;
    feedbackNaoUtil: number;
    porUsuario: Array<{
      usuarioId: string;
      tokens: number;
      mensagens: number;
    }>;
  }> {
    const inicio = this.inicioDoDia();
    const mensagens = await this.prisma.mensagem.findMany({
      where: {
        isUser: false,
        criadoEm: { gte: inicio },
      },
      select: {
        tokensUsados: true,
        feedback: true,
        conversacao: { select: { usuarioId: true } },
      },
    });

    const porUsuarioMap = new Map<
      string,
      { tokens: number; mensagens: number }
    >();

    let tokensTotal = 0;
    let feedbackUtil = 0;
    let feedbackNaoUtil = 0;

    for (const msg of mensagens) {
      tokensTotal += msg.tokensUsados ?? 0;
      if (msg.feedback === 'util') feedbackUtil += 1;
      if (msg.feedback === 'nao_util') feedbackNaoUtil += 1;

      const uid = msg.conversacao.usuarioId;
      const atual = porUsuarioMap.get(uid) ?? { tokens: 0, mensagens: 0 };
      atual.tokens += msg.tokensUsados ?? 0;
      atual.mensagens += 1;
      porUsuarioMap.set(uid, atual);
    }

    return {
      dia: inicio.toISOString().slice(0, 10),
      tokensTotal,
      mensagensIa: mensagens.length,
      feedbackUtil,
      feedbackNaoUtil,
      porUsuario: Array.from(porUsuarioMap.entries())
        .map(([usuarioId, dados]) => ({ usuarioId, ...dados }))
        .sort((a, b) => b.tokens - a.tokens),
    };
  }
}
