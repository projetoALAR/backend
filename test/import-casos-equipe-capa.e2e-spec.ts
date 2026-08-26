import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarHttpApp } from './../src/app.setup';
import { cnjValidoDeSeed, cpfValidoDeSeed } from './helpers/documento-e2e';

/**
 * Importação de casos e equipe + capa PDF + feedback de chat.
 * Requer DATABASE_URL (CI sobe Postgres; local usa .env).
 */
describe('Import casos/equipe + capa + chat feedback (e2e)', () => {
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
        'Admin com 2FA ativo — use conta sem TOTP para o e2e de importação.',
      );
    }
    expect(res.body.access_token).toBeTruthy();
    token = res.body.access_token as string;
  });

  it('importação equipe: preview → importar CSV', async () => {
    expect(token).toBeTruthy();
    const email = `e2e-eq-${suffix}@alar.test`;
    const csv = [
      'Nome,E-mail,Cargo,Perfil',
      `Membro E2E ${suffix},${email},Assistente,ASSISTENTE`,
    ].join('\n');

    const preview = await request(app.getHttpServer())
      .post('/v1/equipe/importar/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('arquivo', Buffer.from(csv, 'utf8'), {
        filename: 'equipe-e2e.csv',
        contentType: 'text/csv',
      });
    expect([200, 201]).toContain(preview.status);
    expect(preview.body.totalLinhas).toBe(1);

    const mapeamento: Record<string, string | null> = {};
    (preview.body.sugestoes as (string | null)[]).forEach((s, i) => {
      mapeamento[String(i)] = s;
    });
    if (!Object.values(mapeamento).includes('nome')) mapeamento['0'] = 'nome';
    if (!Object.values(mapeamento).includes('email')) mapeamento['1'] = 'email';

    const importRes = await request(app.getHttpServer())
      .post('/v1/equipe/importar')
      .set('Authorization', `Bearer ${token}`)
      .field('mapeamento', JSON.stringify(mapeamento))
      .attach('arquivo', Buffer.from(csv, 'utf8'), {
        filename: 'equipe-e2e.csv',
        contentType: 'text/csv',
      });

    expect([200, 201]).toContain(importRes.status);
    expect(importRes.body.total).toBe(1);
    expect(
      (importRes.body.criados ?? 0) + (importRes.body.duplicados ?? 0),
    ).toBeGreaterThanOrEqual(1);
  }, 25_000);

  it('importação casos: cliente → preview → importar CSV', async () => {
    expect(token).toBeTruthy();
    const cpf = cpfValidoDeSeed(`casos${suffix}`);
    const clienteRes = await request(app.getHttpServer())
      .post('/v1/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: `Cliente Import Caso ${suffix}`,
        tipo: 'PF',
        cpf,
      });
    // Pode já existir no banco compartilhado
    expect([200, 201, 409]).toContain(clienteRes.status);

    const cnj = cnjValidoDeSeed(`imp${suffix}`);
    const csv = [
      'numero,titulo,status,clienteCpf',
      `${cnj},Caso E2E Import ${suffix},Em andamento,${cpf}`,
    ].join('\n');

    const preview = await request(app.getHttpServer())
      .post('/v1/processos/importar/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('arquivo', Buffer.from(csv, 'utf8'), {
        filename: 'casos-e2e.csv',
        contentType: 'text/csv',
      });
    expect([200, 201]).toContain(preview.status);

    const mapeamento: Record<string, string | null> = {};
    (preview.body.sugestoes as (string | null)[]).forEach((s, i) => {
      mapeamento[String(i)] = s;
    });
    if (!Object.values(mapeamento).includes('numero')) mapeamento['0'] = 'numero';
    if (!Object.values(mapeamento).includes('titulo')) mapeamento['1'] = 'titulo';
    if (!Object.values(mapeamento).includes('status')) mapeamento['2'] = 'status';
    if (!Object.values(mapeamento).includes('clienteCpf')) {
      mapeamento['3'] = 'clienteCpf';
    }

    const importRes = await request(app.getHttpServer())
      .post('/v1/processos/importar')
      .set('Authorization', `Bearer ${token}`)
      .field('mapeamento', JSON.stringify(mapeamento))
      .attach('arquivo', Buffer.from(csv, 'utf8'), {
        filename: 'casos-e2e.csv',
        contentType: 'text/csv',
      });

    expect([200, 201]).toContain(importRes.status);
    expect(importRes.body.total).toBe(1);
    expect(
      (importRes.body.criados ?? 0) +
        (importRes.body.duplicados ?? 0) +
        (importRes.body.erros ?? 0),
    ).toBe(1);
  }, 30_000);

  it('capa PDF + feedback de mensagem IA', async () => {
    expect(token).toBeTruthy();
    const cpf = cpfValidoDeSeed(`capa${suffix}`);
    const cliente = await request(app.getHttpServer())
      .post('/v1/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: `Cliente Capa ${suffix}`,
        tipo: 'PF',
        cpf,
      });
    expect([200, 201]).toContain(cliente.status);
    const clienteId = cliente.body.id as string;
    expect(clienteId).toBeTruthy();

    const numero = cnjValidoDeSeed(`capa${suffix}`);

    const caso = await request(app.getHttpServer())
      .post('/v1/processos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: `Caso Capa ${suffix}`,
        numero,
        status: 'Em andamento',
        prioridade: 'Média',
        clienteId,
        prazo: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    expect([200, 201]).toContain(caso.status);
    const processoId = caso.body.id as string;

    const capa = await request(app.getHttpServer())
      .get(`/v1/processos/${processoId}/capa`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(capa.status).toBe(200);
    expect(capa.headers['content-type']).toMatch(/pdf/i);
    expect(Buffer.isBuffer(capa.body) ? capa.body.length : 0).toBeGreaterThan(
      100,
    );

    const conv = await request(app.getHttpServer())
      .get(`/v1/chat/conversas/processo/${processoId}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 201]).toContain(conv.status);
    const conversacaoId = conv.body.id as string;

    const msg = await request(app.getHttpServer())
      .post(`/v1/chat/conversas/${conversacaoId}/mensagens`)
      .set('Authorization', `Bearer ${token}`)
      .send({ conteudo: 'Resuma o caso em uma frase.' });
    expect([200, 201]).toContain(msg.status);
    const mensagemIaId = msg.body.mensagemIa?.id as string;
    expect(mensagemIaId).toBeTruthy();

    const feedback = await request(app.getHttpServer())
      .post(`/v1/chat/mensagens/${mensagemIaId}/feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send({ util: true });
    expect([200, 201]).toContain(feedback.status);
    expect(feedback.body.feedback).toBe('util');

    const metricas = await request(app.getHttpServer())
      .get('/v1/chat/metricas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(metricas.body.dia).toBeTruthy();
    expect(typeof metricas.body.mensagensIa).toBe('number');
  }, 45_000);
});
