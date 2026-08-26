import {
  ehArquivoCsv,
  ehArquivoPlanilha,
  lerPlanilhaComoTabela,
} from './planilha-importacao.util';
import { parsearCsv } from '../clientes/clientes-importacao.util';

export type CampoAlvoImportacao = {
  chave: string;
  rotulo: string;
  obrigatorio?: boolean;
  /** Se true, o valor vai para cpf (11 dígitos) ou cnpj (14). */
  documentoFlexivel?: boolean;
};

export type PreviewImportacao = {
  cabecalhos: string[];
  /** Índice da coluna do arquivo → chave Alar sugerida (ou null). */
  sugestoes: (string | null)[];
  amostra: string[][];
  totalLinhas: number;
  camposAlvo: CampoAlvoImportacao[];
};

export type MapeamentoColunas = Record<string, string | null>;
/** Chaves = índice da coluna como string ("0","1",…). Valor = chave Alar ou null (ignorar). */

export async function lerTabelaDeArquivo(
  buffer: Buffer,
  nomeArquivo: string,
  mime?: string,
): Promise<string[][]> {
  const nome = (nomeArquivo || '').toLowerCase();
  if (
    nome.endsWith('.xlsx') ||
    (ehArquivoPlanilha(nomeArquivo, mime) && !nome.endsWith('.csv'))
  ) {
    return lerPlanilhaComoTabela(buffer);
  }
  if (ehArquivoCsv(nomeArquivo, mime) || nome.endsWith('.csv')) {
    return parsearCsv(buffer.toString('utf8'));
  }
  throw new Error('Envie um arquivo .xlsx (Excel) ou .csv.');
}

function normalizarCabecalho(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function chaveCabecalho(raw: string): string {
  return normalizarCabecalho(raw).replace(/[_\s]+/g, ' ').trim();
}

/**
 * Monta preview: cabeçalhos, sugestões via aliases, amostra das primeiras linhas.
 */
export function montarPreview(
  tabela: string[][],
  camposAlvo: CampoAlvoImportacao[],
  sugerir: (cabecalho: string) => string | null,
): PreviewImportacao {
  if (tabela.length === 0) {
    throw new Error('Arquivo vazio.');
  }
  const cabecalhos = tabela[0].map((c) => (c ?? '').trim() || '(sem nome)');
  const sugestoes = cabecalhos.map((h) => sugerir(h));
  const dados = tabela.slice(1).filter((row) => row.some((c) => (c ?? '').trim()));
  const amostra = dados.slice(0, 5).map((row) =>
    cabecalhos.map((_, i) => (row[i] ?? '').trim()),
  );
  return {
    cabecalhos,
    sugestoes,
    amostra,
    totalLinhas: dados.length,
    camposAlvo,
  };
}

function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Aplica mapeamento índice→campo sobre a tabela e devolve registros.
 * Suporta campo especial `documento` / `clienteDocumento` (cpfOuCnpj).
 */
export function aplicarMapeamento<T extends { linha: number }>(
  tabela: string[][],
  mapeamento: MapeamentoColunas,
  opcoes: {
    documentoPara?: { cpf: keyof T & string; cnpj: keyof T & string };
  } = {},
): T[] {
  if (tabela.length < 2) return [];

  const resultado: T[] = [];
  for (let i = 1; i < tabela.length; i++) {
    const cells = tabela[i];
    if (!cells.some((c) => (c ?? '').trim())) continue;

    const linha = { linha: i + 1 } as T;
    let temAlgo = false;

    for (const [idxStr, destino] of Object.entries(mapeamento)) {
      if (!destino) continue;
      const idx = Number(idxStr);
      if (Number.isNaN(idx)) continue;
      const valor = (cells[idx] ?? '').trim();
      if (!valor) continue;

      if (
        (destino === 'documento' || destino === 'clienteDocumento') &&
        opcoes.documentoPara
      ) {
        const d = soDigitos(valor);
        if (d.length === 11) {
          (linha as Record<string, unknown>)[opcoes.documentoPara.cpf] = valor;
        } else if (d.length === 14) {
          (linha as Record<string, unknown>)[opcoes.documentoPara.cnpj] = valor;
        } else if (d.length > 0) {
          // tenta pelo tamanho aproximado
          if (d.length <= 11) {
            (linha as Record<string, unknown>)[opcoes.documentoPara.cpf] = valor;
          } else {
            (linha as Record<string, unknown>)[opcoes.documentoPara.cnpj] = valor;
          }
        }
        temAlgo = true;
        continue;
      }

      (linha as Record<string, unknown>)[destino] = valor;
      temAlgo = true;
    }

    if (temAlgo) resultado.push(linha);
  }
  return resultado;
}

/** Converte sugestões do preview em mapeamento inicial. */
export function mapeamentoDasSugestoes(
  sugestoes: (string | null)[],
): MapeamentoColunas {
  const m: MapeamentoColunas = {};
  sugestoes.forEach((s, i) => {
    m[String(i)] = s;
  });
  return m;
}

/** Garante que campos obrigatórios estão mapeados. */
export function validarMapeamento(
  mapeamento: MapeamentoColunas,
  camposAlvo: CampoAlvoImportacao[],
  opcoes?: {
    /** Cada grupo exige pelo menos um campo mapeado. */
    exigirUmDe?: Array<{ chaves: string[]; rotulo: string }>;
  },
): string | null {
  const usados = new Set(
    Object.values(mapeamento).filter((v): v is string => !!v),
  );
  for (const campo of camposAlvo) {
    if (!campo.obrigatorio) continue;
    if (campo.documentoFlexivel) continue;
    if (!usados.has(campo.chave)) {
      return `Mapeie a coluna obrigatória: ${campo.rotulo}`;
    }
  }
  for (const grupo of opcoes?.exigirUmDe ?? []) {
    if (!grupo.chaves.some((k) => usados.has(k))) {
      return `Mapeie ao menos uma coluna: ${grupo.rotulo}`;
    }
  }
  return null;
}
