import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('clientes')
@ApiTags('Clientes')
@ApiBearerAuth('JWT')
export class ClientesController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post()
  async criar(
    @Body() dados: CreateClienteDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.criar(dados);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Cliente ${cliente.nome}`,
      ator,
    });
    return cliente;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  async listarTodos(@CurrentUser() user: CasoAcessoUser) {
    return this.clientesService.listarTodos(user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Get(':id/export')
  async exportar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const payload = await this.clientesService.exportar(id);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'CLIENTE',
      entidadeId: id,
      resumo: `Exportação LGPD — ${payload.cliente.nome}`,
      ator,
    });
    return payload;
  }

  @Roles(Role.ADMIN)
  @Post(':id/anonimizar')
  async anonimizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.anonimizar(id);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Anonimização LGPD — ${cliente.nome}`,
      ator,
    });
    return cliente;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateClienteDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.atualizar(id, dados);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Cliente ${cliente.nome}`,
      ator,
    });
    return cliente;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.remover(id);
    await this.auditoria.registrar({
      acao: 'EXCLUIR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Cliente ${cliente.nome}`,
      ator,
    });
    return cliente;
  }
}
