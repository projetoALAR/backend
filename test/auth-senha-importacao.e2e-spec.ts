import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarHttpApp } from './../src/app.setup';

/**
 * Fluxos novos: reset de senha, admin senha pendente, importação de clientes.
 * Requer DATABASE_URL (CI sobe Postgres; local usa .env).
 */
describe('Auth senha + importação (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const suffix = `${Date.now()}`;
  const adminEmail =
    process.env.E2E_ADMIN_EMAIL ||
    process.env.AUTH_ADMIN_EMAIL ||
    'admin@alar.com.br';
  const adminPassword =
    process.env.E2E_ADMIN_PASSWORD ||
    process.env.AUTH_ADMIN_PASSWORD ||
    'AlarAdminChangeMe1';

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'e2e-test-secret-min-32-chars-long!!';
    process.env.CHAT_ALLOW_MOCK = 'true';
    process.env.AUTH_ADMIN_EMAIL = adminEmail;
    process.env.AUTH_ADMIN_PASSWORD = adminPassword;
    process.env.AUTH_ALLOW_PUBLIC_REGISTER = 'false';
    process.env.SWAGGER_ENABLED = 'false';
    // Garante link de reset em resposta quando SMTP não está configurado
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

  it('login admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, senha: adminPassword });

    expect([200, 201]).toContain(res.status);
    if (res.body.requires2fa) {
      throw new Error(
        'Admin com 2FA ativo — use conta sem TOTP para o e2e de senha.',
      );
    }
    expect(res.body.access_token).toBeTruthy();
    token = res.body.access_token as string;
  });

  it('forgot-password sempre responde ok (e-mail inexistente)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: `nao-existe-${suffix}@alar.test` });
    expect([200, 201]).toContain(res.status);
    expect(res.body.ok).toBe(true);
  });

  it('criar usuário → listar com troca pendente → reset via link', async () => {
    expect(token).toBeTruthy();
    const email = `e2e-senha-${suffix}@alar.test`;
    const senhaTemp = 'AlarTempE2e12';
    const senhaNova = 'AlarNovaE2e99';

    const createRes = await request(app.getHttpServer())
      .post('/v1/auth/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: `E2E Senha ${suffix}`,
        email,
        senha: senhaTemp,
        role: 'ASSISTENTE',
      });
    expect([200, 201]).toContain(createRes.status);
    const userId = createRes.body.user?.id as string;
    expect(userId).toBeTruthy();
    expect(createRes.body.user.mustChangePassword).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get('/v1/auth/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listed = (listRes.body as Array<{ id: string; mustChangePassword?: boolean }>).find(
      (u) => u.id === userId,
    );
    expect(listed?.mustChangePassword).toBe(true);

    const resetAdmin = await request(app.getHttpServer())
      .post(`/v1/auth/usuarios/${userId}/enviar-reset`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([200, 201]).toContain(resetAdmin.status);
    expect(resetAdmin.body.ok).toBe(true);

    const forgot = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email });
    expect([200, 201]).toContain(forgot.status);
    expect(forgot.body.ok).toBe(true);

    const link =
      (forgot.body.devResetLink as string | undefined) ||
      (resetAdmin.body.devResetLink as string | undefined);
    expect(link).toBeTruthy();
    const tokenMatch = /token=([^&]+)/.exec(link!);
    expect(tokenMatch?.[1]).toBeTruthy();

    const resetRes = await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: tokenMatch![1], novaSenha: senhaNova });
    expect([200, 201]).toContain(resetRes.status);
    expect(resetRes.body.ok).toBe(true);

    const loginNovo = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, senha: senhaNova });
    expect([200, 201]).toContain(loginNovo.status);
    expect(loginNovo.body.access_token || loginNovo.body.requires2fa).toBeTruthy();
    if (loginNovo.body.user) {
      expect(loginNovo.body.user.mustChangePassword).toBe(false);
    }
  }, 25_000);

  it('admin define senha temporária', async () => {
    expect(token).toBeTruthy();
    const email = `e2e-temp-${suffix}@alar.test`;

    const createRes = await request(app.getHttpServer())
      .post('/v1/auth/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: `E2E Temp ${suffix}`,
        email,
        senha: 'AlarTempE2e12',
        role: 'ASSISTENTE',
      });
    expect([200, 201]).toContain(createRes.status);
    const userId = createRes.body.user?.id as string;

    const tempRes = await request(app.getHttpServer())
      .post(`/v1/auth/usuarios/${userId}/senha-temporaria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ senha: 'AlarTempNova88' });
    expect([200, 201]).toContain(tempRes.status);
    expect(tempRes.body.ok).toBe(true);

    const loginTemp = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, senha: 'AlarTempNova88' });
    expect([200, 201]).toContain(loginTemp.status);
    if (loginTemp.body.user) {
      expect(loginTemp.body.user.mustChangePassword).toBe(true);
    }
  }, 20_000);

  it('importação clientes: preview → importar CSV', async () => {
    expect(token).toBeTruthy();
    // CPF de teste válido (11 dígitos); e-mail único por execução
    const csv = [
      'Nome,Documento,E-mail',
      `Import E2E ${suffix},390.533.447-05,import-${suffix}@alar.test`,
    ].join('\n');

    const preview = await request(app.getHttpServer())
      .post('/v1/clientes/importar/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('arquivo', Buffer.from(csv, 'utf8'), {
        filename: 'clientes-e2e.csv',
        contentType: 'text/csv',
      });
    expect([200, 201]).toContain(preview.status);
    expect(preview.body.totalLinhas).toBe(1);
    expect(preview.body.cabecalhos?.length).toBeGreaterThanOrEqual(2);

    const mapeamento: Record<string, string | null> = {};
    (preview.body.sugestoes as (string | null)[]).forEach((s, i) => {
      mapeamento[String(i)] = s;
    });
    if (!Object.values(mapeamento).includes('nome')) {
      mapeamento['0'] = 'nome';
    }
    if (
      !Object.values(mapeamento).includes('documento') &&
      !Object.values(mapeamento).includes('cpf')
    ) {
      mapeamento['1'] = 'documento';
    }

    const importRes = await request(app.getHttpServer())
      .post('/v1/clientes/importar')
      .set('Authorization', `Bearer ${token}`)
      .field('mapeamento', JSON.stringify(mapeamento))
      .attach('arquivo', Buffer.from(csv, 'utf8'), {
        filename: 'clientes-e2e.csv',
        contentType: 'text/csv',
      });

    expect([200, 201]).toContain(importRes.status);
    expect(importRes.body.total).toBe(1);
    // Pode ser criado ou duplicado se o CPF já existir no banco compartilhado
    expect(
      importRes.body.criados +
        importRes.body.duplicados +
        importRes.body.erros,
    ).toBe(1);
    expect(importRes.body.erros).toBeLessThanOrEqual(1);
  }, 20_000);
});
