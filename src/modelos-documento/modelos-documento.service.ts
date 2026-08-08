import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateModeloDocumentoDto,
  UpdateModeloDocumentoDto,
} from './modelos-documento.dto';
import { preencherModelo } from './placeholder.util';

@Injectable()
export class ModelosDocumentoService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dados: CreateModeloDocumentoDto) {
    return this.prisma.modeloDocumento.create({
      data: {
        nome: dados.nome.trim(),
        categoria: dados.categoria,
        conteudo: dados.conteudo,
      },
    });
  }

  async listarTodos(categoria?: string) {
    const filtro = categoria?.trim();
    return this.prisma.modeloDocumento.findMany({
      where: filtro ? { categoria: filtro } : undefined,
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
  }

  async buscarPorId(id: string) {
    const modelo = await this.prisma.modeloDocumento.findUnique({
      where: { id },
    });
    if (!modelo) {
      throw new NotFoundException('Modelo de documento não encontrado');
    }
    return modelo;
  }

  async atualizar(id: string, dados: UpdateModeloDocumentoDto) {
    await this.buscarPorId(id);
    return this.prisma.modeloDocumento.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
        ...(dados.categoria !== undefined
          ? { categoria: dados.categoria }
          : {}),
        ...(dados.conteudo !== undefined ? { conteudo: dados.conteudo } : {}),
      },
    });
  }

  async remover(id: string) {
    await this.buscarPorId(id);
    return this.prisma.modeloDocumento.delete({ where: { id } });
  }

  /**
   * Preview do modelo preenchido com dados do processo/cliente.
   * Não persiste — só retorna o texto.
   */
  async previsualizar(modeloId: string, processoId: string) {
    const modelo = await this.buscarPorId(modeloId);
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      include: { cliente: true },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const texto = preencherModelo(modelo.conteudo, {
      cliente: processo.cliente,
      processo: {
        numero: processo.numero,
        titulo: processo.titulo,
        status: processo.status,
        descricao: processo.descricao,
      },
    });

    return {
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      processoId: processo.id,
      texto,
    };
  }
}
