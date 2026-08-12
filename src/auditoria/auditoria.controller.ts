import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { AuditoriaService } from './auditoria.service';
import { ListarAuditQueryDto } from './auditoria.dto';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Roles(Role.ADMIN)
  @Get()
  listar(@Query() query: ListarAuditQueryDto) {
    return this.auditoria.listar(query);
  }
}
