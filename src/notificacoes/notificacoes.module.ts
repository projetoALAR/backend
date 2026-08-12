import { Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { InboxController } from './inbox.controller';
import { PrazosReminderService } from './prazos-reminder.service';
import { PrazosReminderScheduler } from './prazos-reminder.scheduler';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [InboxController],
  providers: [
    NotificacoesService,
    PrazosReminderService,
    PrazosReminderScheduler,
    PrismaService,
  ],
  exports: [NotificacoesService, PrazosReminderService],
})
export class NotificacoesModule {}
