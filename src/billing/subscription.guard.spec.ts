import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SubscriptionGuard } from './subscription.guard';
import { BillingService } from './billing.service';

describe('SubscriptionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  function make(
    requireSub: string | undefined,
    temAcesso: boolean,
  ) {
    const config = {
      get: jest.fn((key: string) =>
        key === 'REQUIRE_SUBSCRIPTION' ? requireSub : undefined,
      ),
    } as unknown as ConfigService;
    const billing = {
      usuarioTemAcesso: jest.fn().mockResolvedValue(temAcesso),
    } as unknown as BillingService;
    return new SubscriptionGuard(reflector, config, billing);
  }

  function ctx(user: unknown, method: string, url: string) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, method, url, originalUrl: url }),
      }),
    } as never;
  }

  it('libera quando REQUIRE_SUBSCRIPTION está off', async () => {
    const guard = make(undefined, false);
    await expect(
      guard.canActivate(ctx({ id: 'u1' }, 'GET', '/v1/processos')),
    ).resolves.toBe(true);
  });

  it('bloqueia usuário sem assinatura', async () => {
    const guard = make('true', false);
    await expect(
      guard.canActivate(ctx({ id: 'u1' }, 'GET', '/v1/processos')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('libera billing e usuário com acesso', async () => {
    const guard = make('1', true);
    await expect(
      guard.canActivate(ctx({ id: 'u1' }, 'GET', '/v1/billing/assinatura')),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(ctx({ id: 'u1' }, 'GET', '/v1/processos')),
    ).resolves.toBe(true);
  });
});
