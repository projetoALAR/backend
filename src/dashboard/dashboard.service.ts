import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async obterResumo() {
    const agora = new Date();

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
      this.prisma.cliente.count(),
      this.prisma.processo.count(),
      this.prisma.processo.count({ where: { concluido: true } }),
      this.prisma.processo.count({ where: { concluido: false } }),
      this.prisma.processo.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.processo.findMany({
        take: 5,
        orderBy: { atualizadoEm: 'desc' },
        include: {
          cliente: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.compromisso.findMany({
        where: { dataHora: { gte: agora } },
        take: 5,
        orderBy: { dataHora: 'asc' },
        include: {
          processo: { select: { id: true, numero: true, titulo: true } },
        },
      }),
      this.prisma.processo.findMany({
        where: {
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
