import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';

@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, PrismaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
