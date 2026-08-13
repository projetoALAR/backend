import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';
import {
  CreateProcessoTarefaDto,
  UpdateProcessoTarefaDto,
} from './processos.dto';

const tarefaInclude = {
  criadoPor: { select: { id: true, nome: true, email: true } },
} as const;

@Injectable()
export class ProcessosTarefasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  async listar(processoId: string, user: CasoAcessoUser) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    const tarefas = await this.prisma.processoTarefa.findMany({
      where: { processoId },
      include: tarefaInclude,
      orderBy: [{ concluida: 'asc' }, { ordem: 'asc' }, { criadoEm: 'asc' }],
    });
    return tarefas.map((t) => this.serializar(t));
  }

  async criar(
    processoId: string,
    user: CasoAcessoUser,
    dados: CreateProcessoTarefaDto,
  ) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    const titulo = dados.titulo.trim();
    const agreg = await this.prisma.processoTarefa.aggregate({
      where: { processoId },
      _max: { ordem: true },
    });
    const tarefa = await this.prisma.processoTarefa.create({
      data: {
        processoId,
        titulo,
        ordem: (agreg._max.ordem ?? -1) + 1,
        prazo: dados.prazo ? new Date(dados.prazo) : null,
        criadoPorId: user.id,
      },
      include: tarefaInclude,
    });
    return this.serializar(tarefa);
  }

  async atualizar(
    processoId: string,
    tarefaId: string,
    user: CasoAcessoUser,
    dados: UpdateProcessoTarefaDto,
  ) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    await this.obterDoProcesso(processoId, tarefaId);
    const data: {
      titulo?: string;
      concluida?: boolean;
      prazo?: Date | null;
    } = {};
    if (dados.titulo !== undefined) data.titulo = dados.titulo.trim();
    if (dados.concluida !== undefined) data.concluida = dados.concluida;
    if (dados.prazo !== undefined) {
      data.prazo = dados.prazo ? new Date(dados.prazo) : null;
    }
    const tarefa = await this.prisma.processoTarefa.update({
      where: { id: tarefaId },
      data,
      include: tarefaInclude,
    });
    return this.serializar(tarefa);
  }

  async remover(processoId: string, tarefaId: string, user: CasoAcessoUser) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    await this.obterDoProcesso(processoId, tarefaId);
    const tarefa = await this.prisma.processoTarefa.delete({
      where: { id: tarefaId },
      include: tarefaInclude,
    });
    return this.serializar(tarefa);
  }

  private async obterDoProcesso(processoId: string, tarefaId: string) {
    const tarefa = await this.prisma.processoTarefa.findFirst({
      where: { id: tarefaId, processoId },
    });
    if (!tarefa) {
      throw new NotFoundException('Tarefa não encontrada neste caso');
    }
    return tarefa;
  }

  private serializar(tarefa: {
    id: string;
    processoId: string;
    titulo: string;
    concluida: boolean;
    ordem: number;
    prazo: Date | null;
    criadoPorId: string | null;
    criadoEm: Date;
    atualizadoEm: Date;
    criadoPor: { id: string; nome: string; email: string } | null;
  }) {
    return {
      id: tarefa.id,
      processoId: tarefa.processoId,
      titulo: tarefa.titulo,
      concluida: tarefa.concluida,
      ordem: tarefa.ordem,
      prazo: tarefa.prazo?.toISOString() ?? null,
      criadoPorId: tarefa.criadoPorId,
      criadoPor: tarefa.criadoPor,
      criadoEm: tarefa.criadoEm.toISOString(),
      atualizadoEm: tarefa.atualizadoEm.toISOString(),
    };
  }
}
