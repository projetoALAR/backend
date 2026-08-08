/**
 * ============================================================================
 * SEED — CASOS REAIS PÚBLICOS (DATAJUD / CNJ) — USO NÃO COMERCIAL
 * ============================================================================
 *
 * Busca processos REAIS e PÚBLICOS na API Pública do DataJud (CNJ) e insere
 * no banco local clientes fictícios + processos com numeração CNJ verdadeira
 * e andamentos/movimentações reais.
 *
 * AVISO: uso APENAS para desenvolvimento/teste (Termo de Uso do DataJud;
 * Resoluções CNJ 331/2020 e 446/2022). Dados de PARTES não são expostos —
 * os clientes vinculados são fictícios.
 *
 * Uso:
 *   npm run seed:casos-reais                 # padrão (3 casos × tribunais)
 *   npm run seed:casos-reais -- 5            # 5 casos por tribunal
 *   SEED_TRIBUNAIS=tjsp,tjdft,trf1 npm run seed:casos-reais
 * ============================================================================
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizarNumeroCnj } from '../src/andamentos/datajud-tribunal.util';

type MovimentoBruto = {
  codigo?: number;
  nome?: string;
  dataHora?: string;
  [key: string]: unknown;
};

type CasoDatajud = {
  numeroProcesso?: string;
  grau?: string;
  dataAjuizamento?: string;
  classe?: { nome?: string };
  orgaoJulgador?: { nome?: string };
  movimentos?: MovimentoBruto[];
};

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
const API_KEY = (process.env.DATAJUD_API_KEY ?? '').trim();
const CASOS_POR_TRIBUNAL = Math.max(
  1,
  Number(process.argv[2] ?? process.env.SEED_CASOS_POR_TRIBUNAL ?? 3),
);
const TRIBUNAIS = (process.env.SEED_TRIBUNAIS ?? 'tjsp,tjdft,trf1,trt2')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const NOMES_FICTICIOS = [
  'Maria Oliveira Santos',
  'João Pereira Lima',
  'Ana Clara Souza',
  'Carlos Eduardo Rocha',
  'Fernanda Almeida Costa',
  'Ricardo Gomes Barbosa',
  'Juliana Martins Ferreira',
  'Paulo Henrique Dias',
  'Camila Rodrigues Nunes',
  'André Luiz Carvalho',
  'Patrícia Mendes Silva',
  'Bruno César Teixeira',
];

/** Gera CPF fictício determinístico (formato 000.000.000-00) com dígitos válidos. */
function cpfFicticio(indice: number): string {
  const base = String(100000000 + indice * 7919);
  const digitos = (base + '00').slice(0, 9).split('').map(Number);
  for (let etapa = 0; etapa < 2; etapa++) {
    let soma = 0;
    for (let i = 0; i < 9 + etapa; i++) {
      soma += digitos[i] * (10 + etapa - i);
    }
    digitos.push(((soma * 10) % 11) % 10);
  }
  const n = digitos.join('');
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function novoCliente(id: string) {
  const numero = parseInt(id.replace(/\D/g, ''), 10) || 1;
  return {
    nome: NOMES_FICTICIOS[numero % NOMES_FICTICIOS.length],
    cpf: cpfFicticio(numero),
  };
}

function inferirStatus(movimentos: MovimentoBruto[] | undefined): string {
  const ultimo = movimentos?.at(-1)?.nome ?? '';
  if (/baixa|arquivament|tr[ãa]nsito em julgado/i.test(ultimo)) {
    return 'Arquivado';
  }
  return 'Em andamento';
}

function parseDataAjuizamento(valor: string | undefined): Date {
  if (!valor) return new Date();
  const apenasDigitos = valor.replace(/\D/g, '');
  if (apenasDigitos.length === 14) {
    const ano = apenasDigitos.slice(0, 4);
    const mes = apenasDigitos.slice(4, 6);
    const dia = apenasDigitos.slice(6, 8);
    const hh = apenasDigitos.slice(8, 10);
    const mm = apenasDigitos.slice(10, 12);
    const ss = apenasDigitos.slice(12, 14);
    return new Date(`${ano}-${mes}-${dia}T${hh}:${mm}:${ss}-03:00`);
  }
  return new Date(valor);
}

async function buscarCasosNoDatajud(
  tribunalSigla: string,
  quantidade: number,
): Promise<Array<{ caso: CasoDatajud; tribunalSigla: string }>> {
  if (!API_KEY) {
    throw new Error(
      'DATAJUD_API_KEY não configurada no .env (obtenha em https://www.cnj.jus.br/sistemas/datajud/api-publica/)',
    );
  }

  const url = `${DATAJUD_BASE}/api_publica_${tribunalSigla}/_search`;
  const body = {
    query: {
      bool: {
        must: [{ match: { nivelSigilo: 0 } }],
      },
    },
    size: Math.min(quantidade * 6, 100),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `APIKey ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(
      `DataJud ${tribunalSigla} HTTP ${res.status}: ${texto.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    hits?: { hits?: Array<{ _source?: CasoDatajud }> };
  };
  const candidatos = (json.hits?.hits ?? [])
    .map((h) => ({ caso: h._source ?? {}, tribunalSigla }))
    .filter(({ caso }) => normalizarNumeroCnj(caso.numeroProcesso ?? ''));
  for (let i = candidatos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]];
  }
  return candidatos.slice(0, quantidade);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    await prisma.$connect();
    console.log(
      `[seed] Buscando ${CASOS_POR_TRIBUNAL} caso(s) reais em ${TRIBUNAIS.join(', ')}...`,
    );

    let criados = 0;
    let atualizados = 0;

    for (const tribunal of TRIBUNAIS) {
      try {
        const encontrados = await buscarCasosNoDatajud(
          tribunal,
          CASOS_POR_TRIBUNAL,
        );
        console.log(
          `[seed] ${tribunal}: ${encontrados.length} caso(s) público(s) retornados`,
        );

        for (const { caso, tribunalSigla } of encontrados) {
          const numero = normalizarNumeroCnj(caso.numeroProcesso ?? '')!;
          const movimentos = caso.movimentos ?? [];
          const titulo =
            caso.classe?.nome || caso.orgaoJulgador?.nome || 'Processo público';
          const dataAjuizamento = parseDataAjuizamento(caso.dataAjuizamento);

          const jaExistia = !!(await prisma.processo.findUnique({
            where: { numero },
            select: { id: true },
          }));

          const processo = await prisma.processo.upsert({
            where: { numero },
            create: {
              numero,
              status: inferirStatus(movimentos),
              titulo,
              tribunalSigla,
              prazo: null,
              prioridade: 'media',
              tags: {
                grau: caso.grau ?? null,
                dataAjuizamento: dataAjuizamento.toISOString(),
                orgaoJulgador: caso.orgaoJulgador?.nome ?? null,
                origem: 'datajud-seed',
              },
              cliente: { create: novoCliente(numero) },
            },
            update: { status: inferirStatus(movimentos) },
          });

          let andamentos = 0;
          for (const mov of movimentos) {
            const descricao = (mov.nome ?? '').trim();
            const dataHora = mov.dataHora;
            if (!descricao || !dataHora) continue;

            const data = new Date(dataHora);
            if (Number.isNaN(data.getTime())) continue;

            const existente = await prisma.andamento.findFirst({
              where: {
                processoId: processo.id,
                data,
                descricao,
                codigoMovimento: mov.codigo ?? null,
              },
            });
            if (existente) continue;

            await prisma.andamento.create({
              data: {
                processoId: processo.id,
                data,
                descricao,
                codigoMovimento: mov.codigo ?? null,
                origem: { ...mov, seed: true },
              },
            });
            andamentos += 1;
          }

          if (jaExistia) {
            atualizados += 1;
          } else {
            criados += 1;
          }
          console.log(
            `[seed]   ${numero} | ${titulo} | ${movimentos.length} movimentos (${andamentos} novos andamentos)`,
          );
        }
      } catch (error) {
        console.error(
          `[seed] ERRO em ${tribunal}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log(
      `[seed] Concluído: ${criados} processos criados, ${atualizados} atualizados.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed] Falha fatal:', error);
  process.exit(1);
});
