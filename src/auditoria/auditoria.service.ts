import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  AUDIT_ACOES,
  AUDIT_ENTIDADES,
  type RegistrarAuditInput,
} from './auditoria.types';

export type ListarAuditFiltro = {
  entidade?: string;
  acao?: string;
  usuarioId?: string;
  de?: string;
  ate?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(input: RegistrarAuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          acao: input.acao,
          entidade: input.entidade,
          entidadeId: input.entidadeId ?? '-',
          resumo: input.resumo.slice(0, 500),
          usuarioId: input.ator?.id ?? null,
          usuarioNome: input.ator?.nome?.slice(0, 120) ?? null,
          usuarioEmail: input.ator?.email?.slice(0, 180) ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao gravar audit log (${input.acao} ${input.entidade}): ${String(err)}`,
      );
    }
  }

  async listar(filtro: ListarAuditFiltro) {
    const page = Math.max(1, filtro.page ?? 1);
    const limit = Math.min(100, Math.max(1, filtro.limit ?? 50));
    const where: Prisma.AuditLogWhereInput = {};

    if (
      filtro.entidade &&
      (AUDIT_ENTIDADES as readonly string[]).includes(filtro.entidade)
    ) {
      where.entidade = filtro.entidade;
    }
    if (
      filtro.acao &&
      (AUDIT_ACOES as readonly string[]).includes(filtro.acao)
    ) {
      where.acao = filtro.acao;
    }
    if (filtro.usuarioId) {
      where.usuarioId = filtro.usuarioId;
    }

    if (filtro.de || filtro.ate) {
      where.criadoEm = {};
      if (filtro.de) {
        const de = new Date(filtro.de);
        if (!Number.isNaN(de.getTime())) where.criadoEm.gte = de;
      }
      if (filtro.ate) {
        const ate = new Date(filtro.ate);
        if (!Number.isNaN(ate.getTime())) {
          ate.setHours(23, 59, 59, 999);
          where.criadoEm.lte = ate;
        }
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
