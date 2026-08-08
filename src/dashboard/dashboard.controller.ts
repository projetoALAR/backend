import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get('resumo')
  async obterResumo() {
    return this.dashboardService.obterResumo();
  }
}
