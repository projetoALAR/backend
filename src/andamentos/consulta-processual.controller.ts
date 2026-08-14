import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';
import { AndamentosService } from './andamentos.service';
import { ConsultaProcessualQueryDto } from './andamentos.dto';

@Controller('consulta-processual')
@ApiTags('Andamentos')
@ApiBearerAuth('JWT')
export class ConsultaProcessualController {
  constructor(private readonly andamentos: AndamentosService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  consultar(
    @Query() query: ConsultaProcessualQueryDto,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.andamentos.consultarPublico(query.numero, user);
  }
}
