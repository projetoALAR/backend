import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private casoAcesso: CasoAcessoService,
  ) {}

  async obterResumo(user: CasoAcessoUser) {
    const agora = new Date();
    const whereProcesso = this.casoAcesso.visibilidadeProcesso(user);
    const whereCliente = this.casoAcesso.visibilidadeCliente(user);
    const whereCompromisso = this.casoAcesso.visibilidadeCompromisso(user);

    const [
      totalClientes,
      totalProcessos,
      processosConcluidos,
      processosAtivos,
      processosPorStatus,
      processosRecentes,
      proximosCompromissos,
      processosComPrazo,
      totalMembros,
    ] = await Promise.all([
      this.prisma.cliente.count({ where: whereCliente }),
      this.prisma.processo.count({ where: whereProcesso }),
      this.prisma.processo.count({
        where: { ...whereProcesso, concluido: true },
      }),
      this.prisma.processo.count({
        where: { ...whereProcesso, concluido: false },
      }),
      this.prisma.processo.groupBy({
        by: ['status'],
        where: whereProcesso,
        _count: { status: true },
      }),
      this.prisma.processo.findMany({
        where: whereProcesso,
        take: 5,
        orderBy: { atualizadoEm: 'desc' },
        include: {
          cliente: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.compromisso.findMany({
        where: { ...whereCompromisso, dataHora: { gte: agora } },
        take: 5,
        orderBy: { dataHora: 'asc' },
        include: {
          processo: { select: { id: true, numero: true, titulo: true } },
        },
      }),
      this.prisma.processo.findMany({
        where: {
          ...whereProcesso,
          concluido: false,
          prazo: { not: null, gte: agora },
        },
        take: 5,
        orderBy: { prazo: 'asc' },
        select: {
          id: true,
          titulo: true,
          numero: true,
          prazo: true,
          prioridade: true,
          status: true,
        },
      }),
      this.prisma.membroEquipe.count(),
    ]);

    const percentualConclusao =
      totalProcessos === 0
        ? 0
        : Math.round((processosConcluidos / totalProcessos) * 100);

    return {
      totalClientes,
      totalProcessos,
      processosConcluidos,
      processosAtivos,
      percentualConclusao,
      totalMembros,
      processosPorStatus,
      processosRecentes,
      proximosPrazos: {
        compromissos: proximosCompromissos,
        processos: processosComPrazo,
      },
    };
  }
}
