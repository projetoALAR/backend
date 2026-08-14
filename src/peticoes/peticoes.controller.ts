import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { GerarRascunhoDto, SalvarRascunhoDto } from './peticoes.dto';
import { PeticoesService } from './peticoes.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('peticoes')
@ApiTags('Petições')
@ApiBearerAuth('JWT')
export class PeticoesController {
  constructor(
    private readonly service: PeticoesService,
    private readonly auditoria: AuditoriaService,
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('gerar')
  async gerar(
    @Body() dados: GerarRascunhoDto,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(user, dados.processoId);
    return this.service.gerarRascunho(
      dados.modeloId,
      dados.processoId,
      user.id,
      user.role,
    );
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post('salvar')
  async salvar(
    @Body() dados: SalvarRascunhoDto,
    @CurrentUser() ator: AuditActor & CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(ator, dados.processoId);
    const doc = await this.service.salvarRascunho(dados, ator.id);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'DOCUMENTO',
      entidadeId: doc.id,
      resumo: `Documento ${doc.nome} (rascunho IA — revisão humana confirmada)`,
      ator,
    });
    return doc;
  }
}
