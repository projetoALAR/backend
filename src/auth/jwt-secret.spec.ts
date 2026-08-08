import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from './jwt-secret';

describe('resolveJwtSecret', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('usa JWT_SECRET quando definido', () => {
    const config = {
      get: jest.fn().mockReturnValue('meu-segredo-seguro'),
    } as unknown as ConfigService;

    expect(resolveJwtSecret(config)).toBe('meu-segredo-seguro');
  });

  it('em desenvolvimento permite fallback sem JWT_SECRET', () => {
    process.env.NODE_ENV = 'development';
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(resolveJwtSecret(config)).toBe('alar-dev-secret-change-me');
  });

  it('em produção exige JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    const config = {
      get: jest.fn().mockReturnValue('  '),
    } as unknown as ConfigService;

    expect(() => resolveJwtSecret(config)).toThrow(/JWT_SECRET é obrigatório/);
  });
});
