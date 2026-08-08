import { Module } from '@nestjs/common';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DocumentosModule } from '../documentos/documentos.module';

@Module({
  imports: [NotificacoesModule, DocumentosModule],
  controllers: [EquipeController],
  providers: [EquipeService, PrismaService],
  exports: [EquipeService],
})
export class EquipeModule {}
