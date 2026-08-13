import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarHttpApp } from './../src/app.setup';
import { criarDocumentoOpenApi } from './../src/swagger';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarHttpApp(app);
    await app.init();
  });

  it('/ (GET) retorna info da API', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Alar API');
      });
  });

  it('/health (GET) responde', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(['ok', 'degraded']).toContain(res.body.status);
      });
  });

  it('/auth/login rejeita payload inválido', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'nao-email', senha: '' })
      .expect(400);
  });

  it('/auth/login sem versão não existe', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', senha: 'x' })
      .expect(404);
  });

  it('/v1/health não existe (health fica sem versão)', () => {
    return request(app.getHttpServer()).get('/v1/health').expect(404);
  });

  it('OpenAPI lista rotas /v1 e health sem versão', () => {
    const doc = criarDocumentoOpenApi(app);
    expect(doc.paths['/v1/auth/login']).toBeDefined();
    expect(doc.paths['/auth/login']).toBeUndefined();
    expect(doc.paths['/health']).toBeDefined();
    expect(doc.paths['/']).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
