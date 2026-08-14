import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';
import type { BuscaResposta, BuscaResultadoItem } from './busca.types';

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

@Injectable()
export class BuscaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  async buscar(
    user: CasoAcessoUser,
    termo: string,
    limit = 20,
  ): Promise<BuscaResposta> {
    const q = termo.trim();
    if (q.length < 2) {
      return { resultados: [] };
    }

    const limite = Math.min(Math.max(limit, 1), 30);
    const metade = Math.ceil(limite / 2);
    const digitos = somenteDigitos(q);

    const filtrosTexto: Prisma.StringFilter[] = [
      { contains: q, mode: 'insensitive' },
    ];
    if (digitos.length >= 3 && digitos !== q) {
      filtrosTexto.push({ contains: digitos });
    }

    const [clientes, processos] = await Promise.all([
      this.prisma.cliente.findMany({
        where: {
          AND: [
            this.casoAcesso.visibilidadeCliente(user),
            {
              OR: [
                { nome: { contains: q, mode: 'insensitive' } },
                ...(q.includes('@')
                  ? [{ email: { contains: q, mode: 'insensitive' as const } }]
                  : []),
                ...(digitos.length >= 3
                  ? [{ cpf: { contains: digitos } }]
                  : []),
                ...(digitos.length >= 3
                  ? [{ cnpj: { contains: digitos } }]
                  : []),
                { nomeFantasia: { contains: q, mode: 'insensitive' as const } },
              ],
            },
          ],
        },
        select: {
          id: true,
          nome: true,
          cpf: true,
          cnpj: true,
          tipo: true,
          email: true,
        },
        orderBy: { nome: 'asc' },
        take: metade,
      }),
      this.prisma.processo.findMany({
        where: {
          AND: [
            this.casoAcesso.visibilidadeProcesso(user),
            {
              OR: [
                { titulo: { contains: q, mode: 'insensitive' } },
                ...filtrosTexto.map((f) => ({ numero: f })),
                { cliente: { nome: { contains: q, mode: 'insensitive' } } },
                ...(digitos.length >= 3
                  ? [
                      { cliente: { cpf: { contains: digitos } } },
                      { cliente: { cnpj: { contains: digitos } } },
                    ]
                  : []),
              ],
            },
          ],
        },
        select: {
          id: true,
          numero: true,
          titulo: true,
          status: true,
          cliente: { select: { nome: true } },
        },
        orderBy: { atualizadoEm: 'desc' },
        take: metade,
      }),
    ]);

    const resultados: BuscaResultadoItem[] = [
      ...clientes.map((c) => ({
        id: c.id,
        tipo: 'CLIENTE' as const,
        titulo: c.nome,
        subtitulo: c.tipo === 'PJ' ? c.cnpj : c.cpf,
        href: `/clientes/${c.id}`,
      })),
      ...processos.map((p) => ({
        id: p.id,
        tipo: 'PROCESSO' as const,
        titulo: p.titulo || p.numero,
        subtitulo: `${p.numero}${p.cliente?.nome ? ` · ${p.cliente.nome}` : ''}`,
        href: `/casos/${p.id}`,
      })),
    ];

    return { resultados: resultados.slice(0, limite) };
  }
}
