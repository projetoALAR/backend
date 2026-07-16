import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async obterResumo() {
    // 1. Conta o total de clientes
    const totalClientes = await this.prisma.cliente.count();
    
    // 2. Conta o total de processos
    const totalProcessos = await this.prisma.processo.count();
    
    // 3. Agrupa os processos por status
    const processosPorStatus = await this.prisma.processo.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    return {
      totalClientes,
      totalProcessos,
      processosPorStatus,
    };
  }
}