import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get('resumo')
  async obterResumo(@CurrentUser() user: CasoAcessoUser) {
    return this.dashboardService.obterResumo(user);
  }
}
