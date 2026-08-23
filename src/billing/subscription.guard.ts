import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { BillingService } from './billing.service';

/**
 * Quando REQUIRE_SUBSCRIPTION=true|1, bloqueia API sem assinatura/trial ativa.
 * Rotas @Public() e caminhos de auth/billing/webhook ficam liberados.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
  ) {}

  private enforceAtivo(): boolean {
    const v = this.config.get<string>('REQUIRE_SUBSCRIPTION')?.trim();
    return v === 'true' || v === '1';
  }

  private caminhoLiberado(url: string, method: string): boolean {
    const path = url.split('?')[0];
    if (/\/billing(\/|$)/.test(path)) return true;
    if (/\/auth(\/|$)/.test(path)) return true;
    if (method === 'GET' && /\/health\/?$/.test(path)) return true;
    return false;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.enforceAtivo()) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { id?: string; mustChangePassword?: boolean };
      method?: string;
      url?: string;
      originalUrl?: string;
    }>();

    const method = (req.method || 'GET').toUpperCase();
    const url = `${req.originalUrl || req.url || ''}`;
    if (this.caminhoLiberado(url, method)) return true;

    // Troca de senha obrigatória tem prioridade sobre paywall
    if (req.user?.mustChangePassword) return true;

    const userId = req.user?.id;
    if (!userId) return true; // JwtAuthGuard trata 401

    const ok = await this.billing.usuarioTemAcesso(userId);
    if (!ok) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Assinatura ou período de teste necessário.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    return true;
  }
}
