import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { GerarRascunhoDto, SalvarRascunhoDto } from './peticoes.dto';
import { PeticoesService } from './peticoes.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';

@Controller('peticoes')
export class PeticoesController {
  constructor(
    private readonly service: PeticoesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('gerar')
  gerar(@Body() dados: GerarRascunhoDto) {
    return this.service.gerarRascunho(dados.modeloId, dados.processoId);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post('salvar')
  async salvar(
    @Body() dados: SalvarRascunhoDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const doc = await this.service.salvarRascunho(dados);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'DOCUMENTO',
      entidadeId: doc.id,
      resumo: `Documento ${doc.nome} (rascunho IA)`,
      ator,
    });
    return doc;
  }
}
