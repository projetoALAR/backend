import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarHttpApp } from './../src/app.setup';

/**
 * Fluxo crítico: login → cliente → caso → chat.
 * Upload real depende de Supabase; aqui validamos autenticação da rota.
 *
 * Requer DATABASE_URL apontando para um Postgres acessível
 * (CI sobe Postgres; local usa .env).
 */
describe('Fluxo crítico (e2e)', () => {
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
    process.env.SWAGGER_ENABLED = 'false';

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

  it('health ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(['ok', 'degraded']).toContain(res.body.status);
  });

  it('login admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: adminEmail, senha: adminPassword });

    expect([200, 201]).toContain(res.status);
    if (res.body.requires2fa) {
      throw new Error(
        'Admin com 2FA ativo — defina E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD de uma conta sem TOTP para o e2e.',
      );
    }
    expect(res.body.access_token).toBeTruthy();
    token = res.body.access_token as string;
  });

  it('criar cliente → caso → chat com mock', async () => {
    expect(token).toBeTruthy();

    const clienteRes = await request(app.getHttpServer())
      .post('/v1/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: `Cliente E2E ${suffix}`,
        cpf: `9${suffix.slice(-10)}`.padEnd(11, '0').slice(0, 11),
        email: `e2e-${suffix}@alar.test`,
      });

    expect([200, 201]).toContain(clienteRes.status);
    const clienteId = clienteRes.body.id as string;
    expect(clienteId).toBeTruthy();

    const processoRes = await request(app.getHttpServer())
      .post('/v1/processos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        numero: `E2E-${suffix}`,
        status: 'Em andamento',
        clienteId,
        titulo: `Caso E2E ${suffix}`,
      });

    expect([200, 201]).toContain(processoRes.status);
    const processoId = processoRes.body.id as string;
    expect(processoId).toBeTruthy();

    const conversaRes = await request(app.getHttpServer())
      .get(`/v1/chat/conversas/processo/${processoId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const conversacaoId = conversaRes.body.id as string;
    expect(conversacaoId).toBeTruthy();

    const msgRes = await request(app.getHttpServer())
      .post(`/v1/chat/conversas/${conversacaoId}/mensagens`)
      .set('Authorization', `Bearer ${token}`)
      .send({ conteudo: 'Resumo rápido do caso para teste e2e' });

    expect([200, 201]).toContain(msgRes.status);

    expect(msgRes.body.mensagemUsuario?.conteudo).toContain('Resumo rápido');
    expect(msgRes.body.mensagemIa?.conteudo).toBeTruthy();
    expect(msgRes.body.mensagemIa.isUser).toBe(false);

    const tarefaRes = await request(app.getHttpServer())
      .post(`/v1/processos/${processoId}/tarefas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ titulo: `Checklist E2E ${suffix}` });

    expect([200, 201]).toContain(tarefaRes.status);
    expect(tarefaRes.body.titulo).toContain('Checklist E2E');

    const andamentoRes = await request(app.getHttpServer())
      .post(`/v1/processos/${processoId}/andamentos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: `Andamento interno E2E ${suffix}` });

    expect([200, 201]).toContain(andamentoRes.status);
    expect(andamentoRes.body.manual).toBe(true);
    expect(andamentoRes.body.descricao).toContain('Andamento interno E2E');

    await request(app.getHttpServer())
      .get(`/v1/processos/${processoId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(processoId);
      });

    await request(app.getHttpServer())
      .get(`/v1/processos/${processoId}/tarefas`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.length).toBeGreaterThanOrEqual(1);
      });

    // Upload: exige Supabase — valida que a rota está autenticada
    const uploadRes = await request(app.getHttpServer())
      .post('/v1/documentos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('processoId', processoId)
      .attach('arquivo', Buffer.from('conteudo e2e'), {
        filename: 'teste-e2e.txt',
        contentType: 'text/plain',
      });

    // Com Storage configurado: 201; sem: 4xx/5xx — nunca 401
    expect(uploadRes.status).not.toBe(401);
    expect([201, 400, 500, 502, 503]).toContain(uploadRes.status);
  }, 20_000);
});
