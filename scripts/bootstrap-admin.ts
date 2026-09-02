/**
 * Cria admin inicial se a tabela Usuario está vazia (igual AuthService.ensureAdminUser).
 * Uso: npm run staging:bootstrap-admin
 */
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const count = await prisma.usuario.count();
    if (count > 0) {
      console.log(`[bootstrap] ${count} usuário(s) já existem — nada a fazer.`);
      return;
    }

    const password = (process.env.AUTH_ADMIN_PASSWORD || '').trim();
    if (!password) {
      throw new Error('AUTH_ADMIN_PASSWORD ausente no .env');
    }

    const email =
      process.env.AUTH_ADMIN_EMAIL?.trim() || 'admin@alar.com.br';
    const nome = process.env.AUTH_ADMIN_NOME?.trim() || 'Administrador';

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash: await bcrypt.hash(password, 10),
        role: Role.ADMIN,
      },
    });

    await prisma.preferencia.create({
      data: { usuarioId: usuario.id, nome, email },
    });

    console.log(`[bootstrap] Admin criado: ${email}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[bootstrap] Falha:', err);
  process.exit(1);
});
