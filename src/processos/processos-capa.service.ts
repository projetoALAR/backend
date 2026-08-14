import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma.service';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';

/** Helvetica do PDFKit não cobre acentuação PT. */
function textoPdf(valor?: string | null): string {
  if (!valor) return '-';
  return (
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split('')
      .map((ch) => {
        const code = ch.charCodeAt(0);
        if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
        if (code >= 0x20 && code <= 0x7e) return ch;
        return '';
      })
      .join('')
      .trim() || '-'
  );
}

function dataPt(valor?: Date | string | null): string {
  if (!valor) return '-';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function nomeArquivo(numero: string): string {
  const limpo = numero
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  return `capa-${limpo || 'caso'}.pdf`;
}

@Injectable()
export class ProcessosCapaService {
  constructor(
    private prisma: PrismaService,
    private casoAcesso: CasoAcessoService,
  ) {}

  async gerar(processoId: string, user: CasoAcessoUser) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        cliente: true,
        responsavel: { select: { nome: true, email: true } },
        coResponsavel: { select: { nome: true } },
        compromissos: {
          where: { dataHora: { gte: new Date() } },
          orderBy: { dataHora: 'asc' },
          take: 5,
        },
        tarefas: {
          where: { concluida: false, prazo: { not: null } },
          orderBy: { prazo: 'asc' },
          take: 5,
        },
      },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const buffer = await this.renderizar(processo);
    return { buffer, filename: nomeArquivo(processo.numero) };
  }

  private renderizar(processo: {
    numero: string;
    titulo: string | null;
    status: string;
    prioridade: string | null;
    concluido: boolean;
    prazo: Date | null;
    descricao: string | null;
    cliente: {
      nome: string;
      tipo: string;
      cpf: string | null;
      cnpj: string | null;
      nomeFantasia: string | null;
      cidade: string | null;
      uf: string | null;
    } | null;
    responsavel: { nome: string; email: string } | null;
    coResponsavel: { nome: string } | null;
    compromissos: { titulo: string; dataHora: Date }[];
    tarefas: { titulo: string; prazo: Date | null }[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const linha = (rotulo: string, valor?: string | null) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(textoPdf(rotulo), { continued: true });
        doc.font('Helvetica').text(`  ${textoPdf(valor)}`);
      };

      doc.font('Helvetica-Bold').fontSize(16).text('ALAR');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555555')
        .text('Gestao juridica');
      doc.fillColor('#000000').moveDown(0.4);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.8);

      doc.font('Helvetica-Bold').fontSize(14).text('Capa do processo');
      doc.moveDown(0.6);

      linha('Numero CNJ:', processo.numero);
      linha('Titulo:', processo.titulo || '-');
      linha('Status:', processo.status);
      linha('Prioridade:', processo.prioridade || '-');
      linha('Situacao:', processo.concluido ? 'Concluido' : 'Em andamento');
      linha('Prazo do caso:', dataPt(processo.prazo));
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(11).text('Cliente');
      doc.moveDown(0.2);
      const cliente = processo.cliente;
      if (cliente) {
        linha('Nome:', cliente.nome);
        linha(
          'Tipo:',
          cliente.tipo === 'PJ' ? 'Pessoa juridica' : 'Pessoa fisica',
        );
        linha(
          cliente.tipo === 'PJ' ? 'CNPJ:' : 'CPF:',
          cliente.tipo === 'PJ' ? cliente.cnpj : cliente.cpf,
        );
        if (cliente.nomeFantasia) linha('Nome fantasia:', cliente.nomeFantasia);
        const local = [cliente.cidade, cliente.uf].filter(Boolean).join(' / ');
        if (local) linha('Local:', local);
      } else {
        doc.font('Helvetica').fontSize(9).text('-');
      }
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').fontSize(11).text('Equipe');
      doc.moveDown(0.2);
      linha('Responsavel:', processo.responsavel?.nome || '-');
      if (processo.responsavel?.email) {
        linha('E-mail:', processo.responsavel.email);
      }
      linha('Co-responsavel:', processo.coResponsavel?.nome || '-');
      doc.moveDown(0.5);

      if (processo.descricao) {
        doc.font('Helvetica-Bold').fontSize(11).text('Descricao');
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(9).text(textoPdf(processo.descricao), {
          width: 495,
        });
        doc.moveDown(0.5);
      }

      doc.font('Helvetica-Bold').fontSize(11).text('Proximos compromissos');
      doc.moveDown(0.2);
      if (processo.compromissos.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .text('Nenhum compromisso cadastrado.');
      } else {
        for (const item of processo.compromissos) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .text(
              `${textoPdf(dataPt(item.dataHora))}  -  ${textoPdf(item.titulo)}`,
            );
        }
      }
      doc.moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Tarefas pendentes com prazo');
      doc.moveDown(0.2);
      if (processo.tarefas.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .text('Nenhuma tarefa pendente com data.');
      } else {
        for (const item of processo.tarefas) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .text(
              `${textoPdf(dataPt(item.prazo))}  -  ${textoPdf(item.titulo)}`,
            );
        }
      }

      doc.moveDown(1.2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.4);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#555555')
        .text(
          textoPdf(
            `Documento interno Alar. Gerado em ${new Date().toLocaleString('pt-BR')}. Nao substitui pecas protocoladas.`,
          ),
        );

      doc.end();
    });
  }
}
