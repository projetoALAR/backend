import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LlmService } from './llm.service';
import { ChatContextService } from './chat-context.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, LlmService, ChatContextService, PrismaService],
})
export class ChatModule {}
