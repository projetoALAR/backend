import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';
import type { TimelineEvento } from './processos-timeline.types';
import { isAndamentoManual } from '../andamentos/andamento-origem.util';

@Injectable()
export class ProcessosTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  async listar(processoId: string, user: CasoAcessoUser) {
    await this.casoAcesso.assertPodeVer(user, processoId);

    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: {
        id: true,
        titulo: true,
        numero: true,
        criadoEm: true,
        documentos: {
          select: { id: true, nome: true, criadoEm: true },
          orderBy: { criadoEm: 'desc' },
        },
        compromissos: {
          select: {
            id: true,
            titulo: true,
            descricao: true,
            dataHora: true,
            criadoEm: true,
          },
          orderBy: { dataHora: 'desc' },
        },
        andamentos: {
          select: {
            id: true,
            descricao: true,
            data: true,
            criadoEm: true,
            origem: true,
          },
          orderBy: { data: 'desc' },
        },
        comentarios: {
          select: {
            id: true,
            texto: true,
            criadoEm: true,
            usuario: { select: { nome: true, email: true } },
          },
          orderBy: { criadoEm: 'desc' },
        },
        tarefas: {
          select: {
            id: true,
            titulo: true,
            concluida: true,
            criadoEm: true,
            atualizadoEm: true,
            criadoPor: { select: { nome: true, email: true } },
          },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    if (!processo) {
      return { eventos: [] as TimelineEvento[] };
    }

    const docIds = processo.documentos.map((d) => d.id);
    const auditWhere =
      docIds.length > 0
        ? {
            OR: [
              { entidade: 'PROCESSO', entidadeId: processoId },
              { entidade: 'DOCUMENTO', entidadeId: { in: docIds } },
            ],
          }
        : { entidade: 'PROCESSO', entidadeId: processoId };

    const auditoria = await this.prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });

    const eventos: TimelineEvento[] = [
      {
        id: `criado-${processo.id}`,
        tipo: 'CASO_CRIADO',
        titulo: 'Caso aberto',
        descricao: processo.titulo || processo.numero,
        data: processo.criadoEm.toISOString(),
        autor: null,
      },
      ...processo.documentos.map((d) => ({
        id: `doc-${d.id}`,
        tipo: 'DOCUMENTO' as const,
        titulo: 'Documento enviado',
        descricao: d.nome,
        data: d.criadoEm.toISOString(),
        autor: null,
      })),
      ...processo.compromissos.map((c) => ({
        id: `comp-${c.id}`,
        tipo: 'COMPROMISSO' as const,
        titulo: c.titulo,
        descricao: c.descricao,
        data: c.dataHora.toISOString(),
        autor: null,
      })),
      ...processo.andamentos.map((a) => ({
        id: `and-${a.id}`,
        tipo: 'ANDAMENTO' as const,
        titulo: isAndamentoManual(a.origem)
          ? 'Andamento interno'
          : 'Andamento processual',
        descricao: a.descricao,
        data: a.data.toISOString(),
        autor: null,
      })),
      ...auditoria.map((a) => ({
        id: `audit-${a.id}`,
        tipo: 'AUDITORIA' as const,
        titulo: `${a.acao} · ${a.entidade}`,
        descricao: a.resumo,
        data: a.criadoEm.toISOString(),
        autor: a.usuarioNome
          ? {
              nome: a.usuarioNome,
              email: a.usuarioEmail,
            }
          : null,
      })),
      ...processo.comentarios.map((c) => ({
        id: `com-${c.id}`,
        tipo: 'COMENTARIO' as const,
        titulo: 'Comentário interno',
        descricao: c.texto,
        data: c.criadoEm.toISOString(),
        autor: {
          nome: c.usuario.nome,
          email: c.usuario.email,
        },
      })),
      ...processo.tarefas.map((t) => ({
        id: `tar-${t.id}`,
        tipo: 'TAREFA' as const,
        titulo: t.concluida ? 'Tarefa concluída' : 'Tarefa criada',
        descricao: t.titulo,
        data: (t.concluida ? t.atualizadoEm : t.criadoEm).toISOString(),
        autor: t.criadoPor
          ? { nome: t.criadoPor.nome, email: t.criadoPor.email }
          : null,
      })),
    ];

    eventos.sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
    );

    return { eventos };
  }

  async comentar(processoId: string, user: CasoAcessoUser, texto: string) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    const trimmed = texto.trim();
    const comentario = await this.prisma.processoComentario.create({
      data: {
        processoId,
        usuarioId: user.id,
        texto: trimmed,
      },
      include: {
        usuario: { select: { nome: true, email: true } },
      },
    });
    return {
      id: comentario.id,
      texto: comentario.texto,
      criadoEm: comentario.criadoEm.toISOString(),
      usuario: comentario.usuario,
    };
  }
}
