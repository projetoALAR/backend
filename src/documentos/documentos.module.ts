import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { PrismaService } from '../prisma.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    BillingModule,
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService, PrismaService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
