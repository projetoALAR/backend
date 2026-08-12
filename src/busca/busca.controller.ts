import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';
import { BuscaService } from './busca.service';
import { BuscaQueryDto } from './busca.dto';

@Controller('busca')
@ApiTags('Busca')
@ApiBearerAuth('JWT')
export class BuscaController {
  constructor(private readonly busca: BuscaService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  async buscar(
    @Query() query: BuscaQueryDto,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;
    return this.busca.buscar(user, query.q, Number.isFinite(limit) ? limit : 20);
  }
}
