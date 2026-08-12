import { swaggerHabilitado } from './swagger';

describe('swaggerHabilitado', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('desliga quando SWAGGER_ENABLED=false', () => {
    process.env.SWAGGER_ENABLED = 'false';
    process.env.NODE_ENV = 'development';
    expect(swaggerHabilitado()).toBe(false);
  });

  it('liga quando SWAGGER_ENABLED=true mesmo em production', () => {
    process.env.SWAGGER_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    expect(swaggerHabilitado()).toBe(true);
  });

  it('liga em development por padrão', () => {
    delete process.env.SWAGGER_ENABLED;
    process.env.NODE_ENV = 'development';
    expect(swaggerHabilitado()).toBe(true);
  });

  it('desliga em production por padrão', () => {
    delete process.env.SWAGGER_ENABLED;
    process.env.NODE_ENV = 'production';
    expect(swaggerHabilitado()).toBe(false);
  });
});
