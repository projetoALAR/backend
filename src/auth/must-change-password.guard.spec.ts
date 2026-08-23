import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MustChangePasswordGuard } from './must-change-password.guard';

describe('MustChangePasswordGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  function ctx(user: unknown, method: string, url: string) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, method, url, originalUrl: url }),
      }),
    } as never;
  }

  it('libera usuário sem mustChangePassword', () => {
    const guard = new MustChangePasswordGuard(reflector);
    expect(
      guard.canActivate(ctx({ mustChangePassword: false }, 'GET', '/v1/processos')),
    ).toBe(true);
  });

  it('permite change-password e bloqueia o resto', () => {
    const guard = new MustChangePasswordGuard(reflector);
    expect(
      guard.canActivate(
        ctx({ mustChangePassword: true }, 'POST', '/v1/auth/change-password'),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(ctx({ mustChangePassword: true }, 'GET', '/v1/processos')),
    ).toThrow(ForbiddenException);
  });
});
