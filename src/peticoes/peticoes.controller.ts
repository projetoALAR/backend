import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { GerarRascunhoDto, SalvarRascunhoDto } from './peticoes.dto';
import { PeticoesService } from './peticoes.service';

@Controller('peticoes')
export class PeticoesController {
  constructor(private readonly service: PeticoesService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('gerar')
  gerar(@Body() dados: GerarRascunhoDto) {
    return this.service.gerarRascunho(dados.modeloId, dados.processoId);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post('salvar')
  salvar(@Body() dados: SalvarRascunhoDto) {
    return this.service.salvarRascunho(dados);
  }
}
