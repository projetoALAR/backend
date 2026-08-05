import { Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { InboxController } from './inbox.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [InboxController],
  providers: [NotificacoesService, PrismaService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
