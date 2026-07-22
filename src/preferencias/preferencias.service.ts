import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

const DEFAULT_ID = 'default';

@Injectable()
export class PreferenciasService {
  constructor(private prisma: PrismaService) {}

  async obter() {
    return this.prisma.preferencia.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID },
      update: {},
    });
  }

  async atualizar(dados: Prisma.PreferenciaUpdateInput) {
    await this.obter();
    return this.prisma.preferencia.update({
      where: { id: DEFAULT_ID },
      data: dados,
    });
  }
}
