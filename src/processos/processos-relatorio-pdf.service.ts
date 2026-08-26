import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

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

export type LinhaRelatorioPdfDto = {
  numero: string;
  titulo?: string;
  status: string;
  prioridade?: string;
  prazo?: string;
  situacao?: string;
  cliente?: string;
  responsavel?: string;
};

export type RelatorioPdfPayload = {
  filtrosResumo?: string;
  linhas: LinhaRelatorioPdfDto[];
};

export const MAX_LINHAS_RELATORIO_PDF = 500;

@Injectable()
export class ProcessosRelatorioPdfService {
  async gerar(payload: RelatorioPdfPayload) {
    const totalRecebido = payload.linhas?.length ?? 0;
    const linhas = (payload.linhas || []).slice(0, MAX_LINHAS_RELATORIO_PDF);
    const buffer = await this.renderizar(
      payload.filtrosResumo || 'sem filtros',
      linhas,
      totalRecebido,
    );
    const dia = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `relatorio-casos-${dia}.pdf` };
  }

  private renderizar(
    filtrosResumo: string,
    linhas: LinhaRelatorioPdfDto[],
    totalRecebido: number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const porStatus = new Map<string, number>();
      const porResp = new Map<string, number>();
      for (const l of linhas) {
        const st = l.status || '—';
        porStatus.set(st, (porStatus.get(st) || 0) + 1);
        const resp = (l.responsavel || '').trim() || 'Sem responsavel';
        porResp.set(resp, (porResp.get(resp) || 0) + 1);
      }

      doc.font('Helvetica-Bold').fontSize(16).text('ALAR — Relatorio de casos');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#444')
        .text(`Gerado em ${new Date().toLocaleString('pt-BR')}`)
        .text(`Filtros: ${textoPdf(filtrosResumo)}`)
        .text(`Total no recorte: ${linhas.length} caso(s)`)
        .fillColor('#000')
        .moveDown(0.6);

      doc.font('Helvetica-Bold').fontSize(10).text('Por status');
      doc.font('Helvetica').fontSize(9);
      for (const [k, v] of [...porStatus.entries()].sort(
        (a, b) => b[1] - a[1],
      )) {
        doc.text(`- ${textoPdf(k)}: ${v}`);
      }
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(10).text('Por responsavel');
      doc.font('Helvetica').fontSize(9);
      for (const [k, v] of [...porResp.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)) {
        doc.text(`- ${textoPdf(k)}: ${v}`);
      }
      doc.moveDown(0.8);

      doc.font('Helvetica-Bold').fontSize(10).text('Casos');
      doc.moveDown(0.3);

      const colunas = [
        { key: 'numero' as const, rotulo: 'Numero', w: 110 },
        { key: 'titulo' as const, rotulo: 'Titulo', w: 140 },
        { key: 'cliente' as const, rotulo: 'Cliente', w: 110 },
        { key: 'status' as const, rotulo: 'Status', w: 80 },
        { key: 'prazo' as const, rotulo: 'Prazo', w: 70 },
        { key: 'responsavel' as const, rotulo: 'Responsavel', w: 100 },
      ];

      const startX = doc.x;
      let y = doc.y;
      const rowH = 16;

      const desenharCabecalho = () => {
        let x = startX;
        doc.font('Helvetica-Bold').fontSize(8);
        for (const c of colunas) {
          doc.text(c.rotulo, x, y, { width: c.w, ellipsis: true });
          x += c.w;
        }
        y += rowH;
        doc
          .moveTo(startX, y - 4)
          .lineTo(startX + colunas.reduce((s, c) => s + c.w, 0), y - 4)
          .strokeColor('#ccc')
          .stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#000');
      };

      desenharCabecalho();

      for (const linha of linhas) {
        if (y > doc.page.height - 50) {
          doc.addPage();
          y = doc.page.margins.top;
          desenharCabecalho();
        }
        let x = startX;
        const valores = {
          numero: linha.numero,
          titulo: linha.titulo || '',
          cliente: linha.cliente || '',
          status: linha.status,
          prazo: linha.prazo || '',
          responsavel: linha.responsavel || '',
        };
        for (const c of colunas) {
          doc.text(textoPdf(valores[c.key]), x, y, {
            width: c.w - 4,
            ellipsis: true,
            lineBreak: false,
          });
          x += c.w;
        }
        y += rowH;
      }

      if (totalRecebido > MAX_LINHAS_RELATORIO_PDF) {
        doc.moveDown();
        doc
          .font('Helvetica-Oblique')
          .fontSize(8)
          .text(
            `Lista limitada a ${MAX_LINHAS_RELATORIO_PDF} linhas (${totalRecebido} no filtro). Refine ou use o CSV.`,
          );
      }

      doc.end();
    });
  }
}
