import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { PrismaService } from '../prisma.service';
import { PeticoesController } from './peticoes.controller';
import { PeticoesService } from './peticoes.service';

@Module({
  imports: [ChatModule, DocumentosModule],
  controllers: [PeticoesController],
  providers: [PeticoesService, PrismaService],
})
export class PeticoesModule {}
