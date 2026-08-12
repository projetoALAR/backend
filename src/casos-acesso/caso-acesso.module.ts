import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CasoAcessoService } from './caso-acesso.service';

@Global()
@Module({
  providers: [CasoAcessoService, PrismaService],
  exports: [CasoAcessoService],
})
export class CasoAcessoModule {}
