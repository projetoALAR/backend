/**
 * ============================================================================
 * SEED — ENRIQUECER CASOS DATAJUD COM DESCRIÇÃO + PDFs FICTÍCIOS (IA)
 * ============================================================================
 *
 * Complementa `seed.casos-reais.ts`: para processos com tags.origem = "datajud-seed"
 * ainda sem descrição, gera via LLM um resumo e 1–2 PDFs simulados coerentes com
 * o histórico de andamentos (sem inventar fatos de partes/valores reais).
 *
 * AVISO: uso APENAS em desenvolvimento/demonstração. Números CNJ são reais e
 * públicos; o conteúdo gerado é FICTÍCIO e marcado explicitamente.
 *
 * Pré-requisitos: OPENAI_API_KEY (ou CHAT_ALLOW_MOCK=true), SUPABASE_URL/KEY,
 * DATABASE_URL / DIRECT_URL.
 *
 * Uso:
 *   npm run seed:enriquecer-casos
 * ============================================================================
 */

import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { Pool } from 'pg';
import { LlmService } from '../src/chat/llm.service';

const BUCKET = 'documentos';
const MARCA_FICTICIO =
  '[CONTEÚDO FICTÍCIO GERADO PARA TESTE — não representa o processo real sob este número CNJ]';
const SUFIXO_DOC_SIMULADO = '(simulada)';

function garantirMarca(texto: string): string {
  const t = texto.trim();
  if (t.includes('CONTEÚDO FICTÍCIO') || t.includes('CONTEUDO FICTICIO')) {
    return t;
  }
  return `${MARCA_FICTICIO}\n\n${t}`;
}

/** Helvetica do PDFKit não cobre acentuação PT — remove diacríticos só no PDF. */
function textoParaPdfLatin1(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function renderizarPdf(texto: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const corpo = textoParaPdfLatin1(texto);
    doc.font('Helvetica').fontSize(10).text(corpo, { align: 'justify', lineGap: 2 });
    doc.end();
  });
}

function andamentosIndicamSentenca(
  andamentos: { descricao: string; codigoMovimento: number | null }[],
): boolean {
  return andamentos.some(
    (a) =>
      a.codigoMovimento === 971 ||
      a.codigoMovimento === 978 ||
      /senten[cç]a|decis[aã]o|tr[aâ]nsito em julgado/i.test(a.descricao),
  );
}

function isOrigemDatajudSeed(tags: unknown): boolean {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return false;
  return (tags as Record<string, unknown>).origem === 'datajud-seed';
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const llm = new LlmService(new ConfigService());
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_KEY || '',
  );

  let enriquecidos = 0;
  let pdfsGerados = 0;
  let pulados = 0;
  let erros = 0;

  try {
    const candidatos = await prisma.processo.findMany({
      where: {
        tags: { path: ['origem'], equals: 'datajud-seed' },
      },
      include: {
        andamentos: { orderBy: { data: 'asc' } },
        documentos: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'asc' },
    });

    // Fallback se o filtro JSON do Prisma não casar (ex.: tags como string)
    const processos = candidatos.filter((p) => isOrigemDatajudSeed(p.tags));

    console.log(
      `[enriquecer] ${processos.length} processo(s) com origem datajud-seed`,
    );

    for (const processo of processos) {
      const jaTemDescricao = !!(processo.descricao && processo.descricao.trim());
      const jaTemDocsSimulados = processo.documentos.some((d) =>
        d.nome.includes(SUFIXO_DOC_SIMULADO),
      );

      if (jaTemDescricao || jaTemDocsSimulados) {
        pulados += 1;
        console.log(
          `[enriquecer] PULADO ${processo.numero} (já enriquecido: descricao=${jaTemDescricao}, docsSimulados=${jaTemDocsSimulados})`,
        );
        continue;
      }

      try {
        const listaAndamentos =
          processo.andamentos.length > 0
            ? processo.andamentos
                .map(
                  (a) =>
                    `- ${a.data.toISOString().slice(0, 10)}: ${a.descricao}` +
                    (a.codigoMovimento != null
                      ? ` (código ${a.codigoMovimento})`
                      : ''),
                )
                .join('\n')
            : '(sem andamentos sincronizados)';

        const promptResumo = [
          MARCA_FICTICIO,
          '',
          'Gere um RESUMO CURTO (3 a 5 frases) em português do Brasil, PLAUSÍVEL e GENÉRICO,',
          'compatível com o tipo de ação e o histórico de andamentos abaixo.',
          'NÃO invente nomes de partes, valores, números de sentença ou decisões concretas.',
          'É uma simulação para demonstração de software / UI.',
          'Inclua a marca de conteúdo fictício no início do texto.',
          '',
          `Título/classe: ${processo.titulo || '(sem título)'}`,
          `Tribunal (sigla): ${processo.tribunalSigla || '(desconhecido)'}`,
          `Número CNJ (real/público — NÃO trate o conteúdo como real): ${processo.numero}`,
          '',
          'Histórico de andamentos (rótulos reais do DataJud):',
          listaAndamentos,
        ].join('\n');

        const resumoBruto = await llm.gerarTextoDocumento(promptResumo);
        if (resumoBruto.includes('Não consegui obter resposta da IA')) {
          throw new Error('LLM falhou ao gerar descrição');
        }
        const descricao = garantirMarca(resumoBruto);

        await prisma.processo.update({
          where: { id: processo.id },
          data: { descricao },
        });

        const docsParaGerar: { nome: string; tipo: string }[] = [
          {
            nome: `Petição Inicial ${SUFIXO_DOC_SIMULADO}.pdf`,
            tipo: 'petição inicial genérica (sem nomes/valores reais)',
          },
        ];
        if (andamentosIndicamSentenca(processo.andamentos)) {
          docsParaGerar.push({
            nome: `Sentença ${SUFIXO_DOC_SIMULADO}.pdf`,
            tipo: 'sentença/decisão genérica (sem dispositivo concreto real)',
          });
        }

        for (const docMeta of docsParaGerar) {
          const promptDoc = [
            MARCA_FICTICIO,
            '',
            `Redija o corpo de um documento jurídico do tipo: ${docMeta.tipo}.`,
            'Extensão aproximada: 1 a 2 páginas (cerca de 400–800 palavras).',
            'Estilo formal, genérico, PLAUSÍVEL — demonstração de software.',
            'NÃO invente nomes de partes reais, CPFs, valores ou números de decisão.',
            'Use placeholders como "Autor(a)", "Réu(ré)", "Valor da causa: R$ [valor simbólico]".',
            'Inclua a marca de conteúdo fictício na primeira linha.',
            '',
            `Contexto do caso (classe): ${processo.titulo || '(sem título)'}`,
            `Tribunal: ${processo.tribunalSigla || '(desconhecido)'}`,
            `CNJ (apenas referência pública — conteúdo NÃO é real): ${processo.numero}`,
            '',
            'Andamentos (para coerência temática):',
            listaAndamentos,
            '',
            'Resumo já gerado do caso:',
            descricao,
          ].join('\n');

          const textoDocBruto = await llm.gerarTextoDocumento(promptDoc);
          if (textoDocBruto.includes('Não consegui obter resposta da IA')) {
            throw new Error(`LLM falhou ao gerar ${docMeta.nome}`);
          }
          const textoDoc = garantirMarca(textoDocBruto);
          const pdfBuffer = await renderizarPdf(textoDoc);

          const safeName = docMeta.nome.replace(/[^\w.-]+/g, '_');
          const storagePath = `${processo.id}/${Date.now()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) {
            throw new Error(
              `Upload Supabase falhou (${docMeta.nome}): ${uploadError.message}`,
            );
          }

          await prisma.documento.create({
            data: {
              nome: docMeta.nome,
              urlArquivo: storagePath,
              tamanho: pdfBuffer.length,
              processoId: processo.id,
            },
          });

          pdfsGerados += 1;
          console.log(
            `[enriquecer]   PDF ${docMeta.nome} (${pdfBuffer.length} bytes) → ${storagePath}`,
          );
        }

        enriquecidos += 1;
        console.log(
          `[enriquecer] OK ${processo.numero} | ${processo.titulo || ''} | ${docsParaGerar.length} PDF(s)`,
        );
      } catch (error) {
        erros += 1;
        console.error(
          `[enriquecer] ERRO ${processo.numero}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log(
      `[enriquecer] Concluído: ${enriquecidos} enriquecidos, ${pdfsGerados} PDFs, ${pulados} pulados, ${erros} erros.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[enriquecer] Falha fatal:', error);
  process.exit(1);
});
