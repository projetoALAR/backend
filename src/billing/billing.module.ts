import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AsaasClient } from './asaas.client';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, AsaasClient, PrismaService],
  exports: [BillingService],
})
export class BillingModule {}
