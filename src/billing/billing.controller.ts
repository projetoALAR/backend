import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { BillingService } from './billing.service';
import { CheckoutBillingDto } from './billing.dto';

@Controller('billing')
@ApiTags('Billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('assinatura')
  minha(@CurrentUser() user: { id: string; role: string }) {
    return this.billing.minhaAssinatura(user.id, user.role);
  }

  @Post('checkout')
  @Roles(Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(
    @CurrentUser() user: { id: string; role: string },
    @Body() body: CheckoutBillingDto,
  ) {
    return this.billing.iniciarCheckout(user.id, body, user.role);
  }

  @Public()
  @Post('webhook/asaas')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  webhookAsaas(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    return this.billing.processarWebhook(headers, body);
  }

  @Get('admin/assinaturas')
  @Roles(Role.ADMIN)
  listarAdmin(@CurrentUser() user: { role: string }) {
    this.billing.assertPodeGerenciar(user.role);
    return this.billing.listarAdmin();
  }
}
