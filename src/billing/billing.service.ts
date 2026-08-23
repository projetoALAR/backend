import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { AsaasClient } from './asaas.client';
import {
  CicloCobranca,
  isPlanoId,
  PLANOS_COMERCIAIS,
  PlanoId,
  valorDoPlano,
} from './planos.config';

type AsaasCustomer = { id: string };
type AsaasSubscription = { id: string; status?: string };
type AsaasPaymentList = {
  data?: Array<{ id: string; invoiceUrl?: string; bankSlipUrl?: string; status?: string }>;
};

export type CheckoutDto = {
  planoId: string;
  ciclo?: string;
  cpfCnpj: string;
  /** Se true, libera 14 dias e agenda 1ª cobrança no Asaas para depois do trial. */
  trial?: boolean;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasClient,
    private readonly config: ConfigService,
  ) {}

  asaasHabilitado() {
    return this.asaas.habilitado();
  }

  private normalizeCiclo(raw?: string): CicloCobranca {
    if (!raw) return 'MONTHLY';
    const v = raw.toLowerCase();
    if (v === 'anual' || v === 'yearly') return 'YEARLY';
    return 'MONTHLY';
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, '');
  }

  private assertCpfCnpj(raw: string) {
    const digits = this.onlyDigits(raw);
    if (digits.length !== 11 && digits.length !== 14) {
      throw new BadRequestException('Informe um CPF (11) ou CNPJ (14) válido.');
    }
    return digits;
  }

  private temAcesso(row: {
    status: string;
    trialAte: Date | null;
    vigenteAte: Date | null;
  } | null): boolean {
    if (!row) return false;
    const now = Date.now();
    if (row.status === 'trial' && row.trialAte && row.trialAte.getTime() >= now) {
      return true;
    }
    if (row.status === 'ativa') {
      if (!row.vigenteAte) return true;
      return row.vigenteAte.getTime() >= now;
    }
    // pending com trial ainda válido
    if (
      row.status === 'pending' &&
      row.trialAte &&
      row.trialAte.getTime() >= now
    ) {
      return true;
    }
    return false;
  }

  async usuarioTemAcesso(usuarioId: string): Promise<boolean> {
    const row = await this.prisma.assinatura.findUnique({
      where: { usuarioId },
    });
    return this.temAcesso(row);
  }

  async minhaAssinatura(usuarioId: string) {
    const row = await this.prisma.assinatura.findUnique({
      where: { usuarioId },
    });
    return {
      asaasConfigurado: this.asaasHabilitado(),
      temAcesso: this.temAcesso(row),
      assinatura: row
        ? {
            id: row.id,
            planoId: row.planoId,
            ciclo: row.ciclo,
            status: row.status,
            valor: row.valor,
            invoiceUrl: row.invoiceUrl,
            trialAte: row.trialAte?.toISOString() ?? null,
            vigenteAte: row.vigenteAte?.toISOString() ?? null,
            atualizadoEm: row.atualizadoEm.toISOString(),
          }
        : null,
    };
  }

  async iniciarCheckout(usuarioId: string, dto: CheckoutDto) {
    if (!isPlanoId(dto.planoId)) {
      throw new BadRequestException('Plano inválido.');
    }
    const planoId = dto.planoId as PlanoId;
    const plano = PLANOS_COMERCIAIS[planoId];
    if (!plano.checkoutDisponivel) {
      throw new BadRequestException(
        'Plano Escritório é sob consulta. Fale com o comercial.',
      );
    }

    const ciclo = this.normalizeCiclo(dto.ciclo);
    const cpfCnpj = this.assertCpfCnpj(dto.cpfCnpj);
    const valor = valorDoPlano(planoId, ciclo);
    const usarTrial = Boolean(dto.trial);
    const trialDias = Number(this.config.get('ASAAS_TRIAL_DAYS') || 14);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    if (!this.asaasHabilitado()) {
      // Sem chave Asaas: trial local no banco (dev / antes de configurar gateway)
      if (!usarTrial) {
        throw new BadRequestException(
          'Asaas ainda não está configurado (ASAAS_API_KEY). Use a avaliação gratuita ou configure o gateway.',
        );
      }
      const trialAte = new Date();
      trialAte.setDate(trialAte.getDate() + trialDias);
      const row = await this.prisma.assinatura.upsert({
        where: { usuarioId },
        create: {
          usuarioId,
          planoId,
          ciclo,
          status: 'trial',
          valor,
          cpfCnpj,
          trialAte,
        },
        update: {
          planoId,
          ciclo,
          status: 'trial',
          valor,
          cpfCnpj,
          trialAte,
          asaasCustomerId: null,
          asaasSubscriptionId: null,
          invoiceUrl: null,
          vigenteAte: null,
        },
      });
      return {
        modo: 'trial_local' as const,
        checkoutUrl: null,
        mensagem: `Avaliação de ${trialDias} dias ativada (Asaas ainda não configurado).`,
        ...(await this.minhaAssinatura(usuarioId)),
        assinaturaId: row.id,
      };
    }

    const customer = await this.ensureCustomer(usuarioId, {
      nome: usuario.nome,
      email: usuario.email,
      cpfCnpj,
    });

    const nextDue = new Date();
    if (usarTrial) {
      nextDue.setDate(nextDue.getDate() + trialDias);
    }
    const nextDueDate = nextDue.toISOString().slice(0, 10);

    const existente = await this.prisma.assinatura.findUnique({
      where: { usuarioId },
      select: { asaasSubscriptionId: true, status: true },
    });
    if (
      existente?.asaasSubscriptionId &&
      existente.status !== 'cancelada'
    ) {
      try {
        await this.asaas.request(
          'DELETE',
          `/v3/subscriptions/${existente.asaasSubscriptionId}`,
        );
      } catch (err) {
        this.logger.warn(
          `Falha ao cancelar assinatura antiga ${existente.asaasSubscriptionId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    const subscription = await this.asaas.request<AsaasSubscription>(
      'POST',
      '/v3/subscriptions',
      {
        customer: customer.id,
        billingType: 'UNDEFINED',
        value: valor,
        nextDueDate,
        cycle: ciclo,
        description: `Alar — plano ${plano.nome} (${ciclo === 'YEARLY' ? 'anual' : 'mensal'})`,
        externalReference: usuarioId,
      },
    );

    const invoiceUrl = await this.buscarInvoiceUrl(subscription.id);
    if (!usarTrial && !invoiceUrl) {
      try {
        await this.asaas.request(
          'DELETE',
          `/v3/subscriptions/${subscription.id}`,
        );
      } catch {
        // ignore
      }
      throw new BadRequestException(
        'Assinatura criada no Asaas, mas a fatura ainda não ficou disponível. Tente novamente em instantes.',
      );
    }

    const trialAte = usarTrial
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + trialDias);
          return d;
        })()
      : null;

    await this.prisma.assinatura.upsert({
      where: { usuarioId },
      create: {
        usuarioId,
        planoId,
        ciclo,
        status: usarTrial ? 'trial' : 'pending',
        valor,
        cpfCnpj,
        asaasCustomerId: customer.id,
        asaasSubscriptionId: subscription.id,
        invoiceUrl,
        trialAte,
      },
      update: {
        planoId,
        ciclo,
        status: usarTrial ? 'trial' : 'pending',
        valor,
        cpfCnpj,
        asaasCustomerId: customer.id,
        asaasSubscriptionId: subscription.id,
        invoiceUrl,
        trialAte,
      },
    });

    return {
      modo: usarTrial ? ('trial_asaas' as const) : ('checkout' as const),
      checkoutUrl: invoiceUrl,
      mensagem: usarTrial
        ? `Avaliação de ${trialDias} dias liberada. A 1ª cobrança Asaas vence em ${nextDueDate}.`
        : 'Assinatura criada. Conclua o pagamento na página do Asaas.',
      ...(await this.minhaAssinatura(usuarioId)),
    };
  }

  private async ensureCustomer(
    usuarioId: string,
    dados: { nome: string; email: string; cpfCnpj: string },
  ): Promise<AsaasCustomer> {
    const existente = await this.prisma.assinatura.findUnique({
      where: { usuarioId },
      select: { asaasCustomerId: true },
    });
    if (existente?.asaasCustomerId) {
      return { id: existente.asaasCustomerId };
    }

    return this.asaas.request<AsaasCustomer>('POST', '/v3/customers', {
      name: dados.nome,
      email: dados.email,
      cpfCnpj: dados.cpfCnpj,
      externalReference: usuarioId,
      notificationDisabled: false,
    });
  }

  private async buscarInvoiceUrl(subscriptionId: string): Promise<string | null> {
    try {
      const list = await this.asaas.request<AsaasPaymentList>(
        'GET',
        `/v3/subscriptions/${subscriptionId}/payments?limit=1`,
      );
      const first = list.data?.[0];
      return first?.invoiceUrl || first?.bankSlipUrl || null;
    } catch (err) {
      this.logger.warn(
        `Não foi possível obter invoice da assinatura ${subscriptionId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }
  }

  async processarWebhook(headers: Record<string, string | string[] | undefined>, body: unknown) {
    const expected = this.config.get<string>('ASAAS_WEBHOOK_TOKEN')?.trim();
    if (!expected) {
      throw new UnauthorizedException(
        'ASAAS_WEBHOOK_TOKEN não configurado — webhook recusado.',
      );
    }
    const raw = headers['asaas-access-token'] ?? headers['Asaas-Access-Token'];
    const received = Array.isArray(raw) ? raw[0] : raw;
    if (!received || received !== expected) {
      throw new UnauthorizedException('Webhook Asaas não autorizado.');
    }

    const payload = body as {
      event?: string;
      payment?: {
        id?: string;
        status?: string;
        subscription?: string;
        customer?: string;
        dueDate?: string;
        paymentDate?: string;
        confirmedDate?: string;
        value?: number;
      };
    };

    const event = payload.event || '';
    const payment = payload.payment;
    if (!payment?.subscription) {
      return { ok: true, ignored: true };
    }

    const row = await this.prisma.assinatura.findFirst({
      where: { asaasSubscriptionId: payment.subscription },
    });
    if (!row) {
      this.logger.warn(
        `Webhook ${event}: assinatura Asaas ${payment.subscription} não encontrada`,
      );
      return { ok: true, ignored: true };
    }

    const pago =
      event === 'PAYMENT_RECEIVED' ||
      event === 'PAYMENT_CONFIRMED' ||
      payment.status === 'RECEIVED' ||
      payment.status === 'CONFIRMED';

    const vencido =
      event === 'PAYMENT_OVERDUE' || payment.status === 'OVERDUE';

    const cancelado =
      event === 'PAYMENT_DELETED' ||
      event === 'PAYMENT_REFUNDED' ||
      payment.status === 'REFUNDED';

    if (pago) {
      const vigenteAte = new Date();
      if (row.ciclo === 'YEARLY') {
        vigenteAte.setFullYear(vigenteAte.getFullYear() + 1);
      } else {
        vigenteAte.setMonth(vigenteAte.getMonth() + 1);
      }
      await this.prisma.assinatura.update({
        where: { id: row.id },
        data: {
          status: 'ativa',
          vigenteAte,
          trialAte: null,
        },
      });
      this.logger.log(`Assinatura ${row.id} ativada via ${event}`);
      return { ok: true, status: 'ativa' };
    }

    if (vencido) {
      await this.prisma.assinatura.update({
        where: { id: row.id },
        data: { status: 'past_due' },
      });
      return { ok: true, status: 'past_due' };
    }

    if (cancelado) {
      await this.prisma.assinatura.update({
        where: { id: row.id },
        data: { status: 'cancelada' },
      });
      return { ok: true, status: 'cancelada' };
    }

    return { ok: true, event };
  }

  /** Admin: lista rápida (sem dados sensíveis demais). */
  async listarAdmin() {
    return this.prisma.assinatura.findMany({
      orderBy: { atualizadoEm: 'desc' },
      take: 100,
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
      },
    });
  }

  assertPodeGerenciar(role: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Apenas admin.');
    }
  }
}
