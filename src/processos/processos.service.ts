import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CreateProcessoDto, UpdateProcessoDto } from './processos.dto';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';

const usuarioResumo = {
  select: { id: true, nome: true, email: true, role: true },
} as const;

const processoInclude = {
  cliente: {
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      cpf: true,
    },
  },
  responsavel: usuarioResumo,
  coResponsavel: usuarioResumo,
} satisfies Prisma.ProcessoInclude;

@Injectable()
export class ProcessosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private casoAcesso: CasoAcessoService,
  ) {}

  async criar(dados: CreateProcessoDto, atorId?: string) {
    const { responsavelId, coResponsavelId } = await this.resolverEquipe(
      dados.responsavelId !== undefined ? dados.responsavelId : atorId ?? null,
      dados.coResponsavelId ?? null,
    );

    const processo = await this.prisma.processo.create({
      data: {
        numero: dados.numero.trim(),
        status: dados.status,
        clienteId: dados.clienteId,
        titulo: dados.titulo,
        descricao: dados.descricao ?? null,
        prioridade: dados.prioridade,
        prazo: dados.prazo ? new Date(dados.prazo) : null,
        tags: dados.tags ?? undefined,
        concluido: dados.concluido ?? false,
        responsavelId,
        coResponsavelId,
      },
      include: processoInclude,
    });

    if (processo.prazo) {
      const quando = new Date(processo.prazo).toLocaleDateString('pt-BR');
      await this.notificacoes.notificarTodosUsuarios(
        'Novo caso com prazo',
        `${processo.titulo || processo.numero} — prazo ${quando}`,
        `/tasks?caseId=${processo.id}`,
        'reminders',
      );
    }

    return processo;
  }

  async listarPorCliente(clienteId: string, user: CasoAcessoUser) {
    return this.prisma.processo.findMany({
      where: {
        clienteId,
        ...this.casoAcesso.visibilidadeProcesso(user),
      },
      include: processoInclude,
      orderBy: { criadoEm: 'desc' },
    });
  }

  async listarTodos(user: CasoAcessoUser) {
    return this.prisma.processo.findMany({
      where: this.casoAcesso.visibilidadeProcesso(user),
      include: {
        ...processoInclude,
        _count: { select: { documentos: true, compromissos: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(id: string, dados: UpdateProcessoDto) {
    const numeroNovo =
      dados.numero !== undefined ? dados.numero.trim() : undefined;

    const equipe =
      dados.responsavelId !== undefined || dados.coResponsavelId !== undefined
        ? await this.equipeParaUpdate(id, dados)
        : {};

    return this.prisma.processo.update({
      where: { id },
      data: {
        ...(numeroNovo !== undefined
          ? {
              numero: numeroNovo,
              tribunalSigla: null,
            }
          : {}),
        ...(dados.status !== undefined ? { status: dados.status } : {}),
        ...(dados.clienteId !== undefined
          ? { clienteId: dados.clienteId }
          : {}),
        ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
        ...(dados.descricao !== undefined
          ? { descricao: dados.descricao }
          : {}),
        ...(dados.prioridade !== undefined
          ? { prioridade: dados.prioridade }
          : {}),
        ...(dados.prazo !== undefined
          ? { prazo: dados.prazo ? new Date(dados.prazo) : null }
          : {}),
        ...(dados.tags !== undefined ? { tags: dados.tags } : {}),
        ...(dados.concluido !== undefined
          ? { concluido: dados.concluido }
          : {}),
        ...equipe,
      },
      include: processoInclude,
    });
  }

  async remover(id: string) {
    return this.prisma.processo.delete({
      where: { id },
    });
  }

  private async equipeParaUpdate(id: string, dados: UpdateProcessoDto) {
    const atual = await this.prisma.processo.findUnique({
      where: { id },
      select: { responsavelId: true, coResponsavelId: true },
    });
    const responsavelId =
      dados.responsavelId !== undefined
        ? dados.responsavelId
        : (atual?.responsavelId ?? null);
    const coResponsavelId =
      dados.coResponsavelId !== undefined
        ? dados.coResponsavelId
        : (atual?.coResponsavelId ?? null);
    return this.resolverEquipe(responsavelId, coResponsavelId);
  }

  private async resolverEquipe(
    responsavelId: string | null,
    coResponsavelId: string | null,
  ) {
    if (responsavelId && coResponsavelId && responsavelId === coResponsavelId) {
      throw new BadRequestException(
        'Responsável e co-responsável devem ser pessoas diferentes',
      );
    }
    await this.assertUsuario(responsavelId);
    await this.assertUsuario(coResponsavelId);
    return { responsavelId, coResponsavelId };
  }

  private async assertUsuario(id: string | null) {
    if (!id) return;
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!usuario) {
      throw new BadRequestException('Usuário da equipe não encontrado');
    }
  }
}
