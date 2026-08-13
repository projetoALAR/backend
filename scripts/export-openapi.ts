import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configurarHttpApp } from '../src/app.setup';
import { criarDocumentoOpenApi } from '../src/swagger';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarHttpApp(app);
  await app.init();

  const document = criarDocumentoOpenApi(app);
  const json = JSON.stringify(document);
  const out = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(out, json);
  console.log(`OpenAPI gravado em ${out}`);

  const frontOut = resolve(
    __dirname,
    '..',
    '..',
    'workspace-juridico-frontend',
    'openapi',
    'alar.json',
  );
  if (existsSync(resolve(frontOut, '..'))) {
    mkdirSync(resolve(frontOut, '..'), { recursive: true });
    writeFileSync(frontOut, json);
    console.log(`Cópia no front: ${frontOut}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
