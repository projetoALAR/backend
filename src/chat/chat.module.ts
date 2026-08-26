import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LlmService } from './llm.service';
import { ChatContextService } from './chat-context.service';
import { ChatQuotaService } from './chat-quota.service';
import { PrismaService } from '../prisma.service';
import { DocumentosModule } from '../documentos/documentos.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [DocumentosModule, BillingModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    LlmService,
    ChatContextService,
    ChatQuotaService,
    PrismaService,
  ],
  exports: [LlmService, ChatContextService, ChatQuotaService],
})
export class ChatModule {}
