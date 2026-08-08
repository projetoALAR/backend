import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from './roles';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

function mockContext(user?: { role?: Role }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('permite rota pública', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('bloqueia quando não há @Roles (fail-closed)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(() =>
      guard.canActivate(mockContext({ role: Role.ASSISTENTE })),
    ).toThrow(ForbiddenException);
  });

  it('permite papel autorizado', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.ADMIN, Role.ADVOGADO];
      return undefined;
    });
    expect(guard.canActivate(mockContext({ role: Role.ADVOGADO }))).toBe(true);
  });

  it('bloqueia papel não autorizado', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return [Role.ADMIN];
      return undefined;
    });
    expect(() =>
      guard.canActivate(mockContext({ role: Role.ASSISTENTE })),
    ).toThrow(ForbiddenException);
  });
});
