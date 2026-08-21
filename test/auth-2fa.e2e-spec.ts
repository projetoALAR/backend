import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as OTPAuth from 'otpauth';
import { AppModule } from './../src/app.module';
import { configurarHttpApp } from './../src/app.setup';

/**
 * Fluxo 2FA em usuário temporário (não altera o admin permanente).
 */
describe('Auth 2FA (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = `${Date.now()}`;
  const adminEmail =
    process.env.E2E_ADMIN_EMAIL ||
    process.env.AUTH_ADMIN_EMAIL ||
    'admin@alar.com.br';
  const adminPassword =
    process.env.E2E_ADMIN_PASSWORD ||
    process.env.AUTH_ADMIN_PASSWORD ||
    'AlarAdminChangeMe1';

  const userEmail = `e2e-2fa-${suffix}@alar.test`;
  let userPassword = 'AlarDoisFatores99';

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'e2e-test-secret-min-32-chars-long!!';
    process.env.CHAT_ALLOW_MOCK = 'true';
    process.env.AUTH_ADMIN_EMAIL = adminEmail;
    process.env.AUTH_ADMIN_PASSWORD = adminPassword;
    process.env.AUTH_ALLOW_PUBLIC_REGISTER = 'false';
    process.env.SWAGGER_ENABLED = 'false';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    if (process.env.NODE_ENV === 'production') {
      process.env.NODE_ENV = 'test';
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarHttpApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function codigoTotp(secret: string, email: string): string {
    const totp = new OTPAuth.TOTP({
      issuer: 'Alar',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.generate();
  }

  it('setup → enable → login com verify', async () => {
    const loginAdmin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, senha: adminPassword });
    expect([200, 201]).toContain(loginAdmin.status);
    if (loginAdmin.body.requires2fa) {
      throw new Error('Admin com 2FA — use conta sem TOTP para este e2e.');
    }
    const adminToken = loginAdmin.body.access_token as string;

    const create = await request(app.getHttpServer())
      .post('/v1/auth/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: `E2E 2FA ${suffix}`,
        email: userEmail,
        senha: userPassword,
        role: 'ADVOGADO',
      });
    expect([200, 201]).toContain(create.status);

    let loginUser = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: userEmail, senha: userPassword });
    expect([200, 201]).toContain(loginUser.status);
    expect(loginUser.body.access_token || loginUser.body.requires2fa).toBeTruthy();

    // Convite admin sempre cria com mustChangePassword
    if (loginUser.body.user?.mustChangePassword || loginUser.body.access_token) {
      const token = loginUser.body.access_token as string;
      if (token && loginUser.body.user?.mustChangePassword) {
        const nova = 'AlarDoisFatores88';
        const change = await request(app.getHttpServer())
          .post('/v1/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ senhaAtual: userPassword, novaSenha: nova });
        expect([200, 201]).toContain(change.status);
        userPassword = nova;
        loginUser = await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({ email: userEmail, senha: userPassword });
        expect([200, 201]).toContain(loginUser.status);
      }
    }

    const userToken = loginUser.body.access_token as string;
    expect(userToken).toBeTruthy();

    const setup = await request(app.getHttpServer())
      .post('/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${userToken}`);
    expect([200, 201]).toContain(setup.status);
    const secret = setup.body.secret as string;
    expect(secret).toBeTruthy();

    const enable = await request(app.getHttpServer())
      .post('/v1/auth/2fa/enable')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: codigoTotp(secret, userEmail) });
    expect([200, 201]).toContain(enable.status);

    const login2fa = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: userEmail, senha: userPassword });
    expect([200, 201]).toContain(login2fa.status);
    expect(login2fa.body.requires2fa).toBe(true);
    expect(login2fa.body.preAuthToken).toBeTruthy();

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/2fa/verify')
      .send({
        preAuthToken: login2fa.body.preAuthToken,
        code: codigoTotp(secret, userEmail),
      });
    expect([200, 201]).toContain(verify.status);
    expect(verify.body.access_token).toBeTruthy();
  }, 45_000);
});
