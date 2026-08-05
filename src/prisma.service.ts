import 'dotenv/config'; // Garante que a URL seja lida
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // 1. Criamos a conexão nativa com o PostgreSQL usando sua URL do .env
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // 2. Passamos essa conexão para o adaptador do Prisma
    const adapter = new PrismaPg(pool);

    // 3. Entregamos o adaptador ao PrismaClient
    super({
      adapter,
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
