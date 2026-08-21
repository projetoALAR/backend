import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarHttpApp } from './../src/app.setup';
import { cnjValidoDeSeed, cpfValidoDeSeed } from './helpers/documento-e2e';

/**
 * Agenda / Prazos: criar → listar (geral e por caso) → editar → excluir.
 * Requer DATABASE_URL (CI sobe Postgres; local usa .env).
 */
describe('Compromissos agenda/prazos (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let processoId: string;
  let compromissoId: string;
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
    process.env.SWAGGER_ENABLED = 'false';
    // ConfigModule não sobrescreve vars já definidas — zera SMTP para o e2e
    process.env.SMTP_HOST = '';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarHttpApp(app);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app.close();
  }, 30_000);

  it('login admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, senha: adminPassword });

    expect([200, 201]).toContain(res.status);
    if (res.body.requires2fa) {
      throw new Error(
        'Admin com 2FA ativo — use conta sem TOTP para o e2e de compromissos.',
      );
    }
    expect(res.body.access_token).toBeTruthy();
    token = res.body.access_token as string;
  });

  it('criar cliente e caso para vincular', async () => {
    expect(token).toBeTruthy();

    const clienteRes = await request(app.getHttpServer())
      .post('/v1/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: `Cliente Agenda E2E ${suffix}`,
        cpf: cpfValidoDeSeed(`8${suffix}`),
        email: `agenda-e2e-${suffix}@alar.test`,
      });

    expect([200, 201]).toContain(clienteRes.status);
    const clienteId = clienteRes.body.id as string;
    expect(clienteId).toBeTruthy();

    const processoRes = await request(app.getHttpServer())
      .post('/v1/processos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero: cnjValidoDeSeed(`age${suffix}`),
        status: 'Em andamento',
        clienteId,
        titulo: `Caso Agenda E2E ${suffix}`,
      });

    expect([200, 201]).toContain(processoRes.status);
    processoId = processoRes.body.id as string;
    expect(processoId).toBeTruthy();
  });

  it('criar compromisso vinculado ao caso', async () => {
    expect(token).toBeTruthy();
    expect(processoId).toBeTruthy();

    const dataHora = new Date();
    dataHora.setDate(dataHora.getDate() + 3);
    dataHora.setHours(10, 0, 0, 0);

    const res = await request(app.getHttpServer())
      .post('/v1/compromissos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: `Audiência E2E ${suffix}`,
        descricao: 'Compromisso criado no e2e',
        dataHora: dataHora.toISOString(),
        processoId,
      });

    expect([200, 201]).toContain(res.status);
    compromissoId = res.body.id as string;
    expect(compromissoId).toBeTruthy();
    expect(res.body.titulo).toContain('Audiência E2E');
    expect(res.body.processoId).toBe(processoId);
  }, 45_000);

  it('listar na agenda e na aba do caso', async () => {
    expect(compromissoId).toBeTruthy();

    const todos = await request(app.getHttpServer())
      .get('/v1/compromissos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      (todos.body as { id: string }[]).some((c) => c.id === compromissoId),
    ).toBe(true);

    const porCaso = await request(app.getHttpServer())
      .get(`/v1/compromissos/processo/${processoId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      (porCaso.body as { id: string }[]).some((c) => c.id === compromissoId),
    ).toBe(true);
  });

  it('editar compromisso', async () => {
    expect(compromissoId).toBeTruthy();

    const novaData = new Date();
    novaData.setDate(novaData.getDate() + 5);
    novaData.setHours(14, 30, 0, 0);

    const res = await request(app.getHttpServer())
      .put(`/v1/compromissos/${compromissoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: `Audiência E2E editada ${suffix}`,
        descricao: 'Atualizado no e2e',
        dataHora: novaData.toISOString(),
        processoId,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.titulo).toContain('editada');
    expect(res.body.descricao).toBe('Atualizado no e2e');
    expect(res.body.processoId).toBe(processoId);
  });

  it('excluir compromisso e confirmar ausência', async () => {
    expect(compromissoId).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/v1/compromissos/${compromissoId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const porCaso = await request(app.getHttpServer())
      .get(`/v1/compromissos/processo/${processoId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      (porCaso.body as { id: string }[]).some((c) => c.id === compromissoId),
    ).toBe(false);

    const todos = await request(app.getHttpServer())
      .get('/v1/compromissos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      (todos.body as { id: string }[]).some((c) => c.id === compromissoId),
    ).toBe(false);
  });
});
