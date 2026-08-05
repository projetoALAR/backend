import { Module } from '@nestjs/common';
import { CompromissosService } from './compromissos.service';
import { CompromissosController } from './compromissos.controller';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [CompromissosController],
  providers: [CompromissosService, PrismaService],
})
export class CompromissosModule {}
