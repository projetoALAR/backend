import { Module } from '@nestjs/common';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [NotificacoesModule, DocumentosModule, BillingModule],
  controllers: [EquipeController],
  providers: [EquipeService, PrismaService],
  exports: [EquipeService],
})
export class EquipeModule {}
