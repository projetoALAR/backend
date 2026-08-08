/**
 * Sincroniza andamentos DataJud para todos os processos abertos.
 * Uso: npx ts-node -r dotenv/config scripts/sync-andamentos-agora.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AndamentosService } from '../src/andamentos/andamentos.service';
import { PrismaService } from '../src/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const andamentos = app.get(AndamentosService);

  const processos = await prisma.processo.findMany({
    where: { concluido: false },
    select: { id: true, numero: true, titulo: true },
    orderBy: { criadoEm: 'desc' },
  });

  console.log(`Processos abertos: ${processos.length}`);

  let ok = 0;
  let falhas = 0;
  let inseridos = 0;

  for (const p of processos) {
    const label = `${p.titulo || p.numero} (${p.numero})`;
    try {
      const resultado = await andamentos.sincronizarProcesso(p.id);
      ok += 1;
      inseridos += resultado.inseridos;
      console.log(
        `OK  ${label} → +${resultado.inseridos}${resultado.motivo ? ` (${resultado.motivo})` : ''}`,
      );
    } catch (error) {
      falhas += 1;
      console.error(
        `ERR ${label}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(
    `\nConcluído: ${ok} ok, ${falhas} falhas, ${inseridos} andamentos novos`,
  );
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
