import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const processos = await prisma.processo.findMany({
    select: {
      numero: true,
      titulo: true,
      tribunalSigla: true,
      concluido: true,
      _count: { select: { andamentos: true } },
    },
    orderBy: { criadoEm: 'desc' },
  });

  const totalAndamentos = await prisma.andamento.count();

  console.log(`Processos: ${processos.length}`);
  console.log(`Andamentos no total: ${totalAndamentos}`);
  console.log('---');
  for (const p of processos) {
    const nome = p.titulo || '(sem título)';
    const tribunal = p.tribunalSigla || '?';
    console.log(
      `${p._count.andamentos.toString().padStart(3)} andamentos | ${tribunal.padEnd(6)} | ${nome} | ${p.numero}`,
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
