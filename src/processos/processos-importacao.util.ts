import { parsearCsv } from '../clientes/clientes-importacao.util';
import { PROCESSO_STATUS } from './processos.dto';

export const COLUNAS_IMPORTACAO_PROCESSOS = [
  'numero',
  'titulo',
  'status',
  'prioridade',
  'prazo',
  'descricao',
  'clienteCpf',
  'clienteCnpj',
  'tags',
] as const;

export type ColunaImportacaoProcesso =
  (typeof COLUNAS_IMPORTACAO_PROCESSOS)[number];

export type LinhaImportacaoProcesso = Partial<
  Record<ColunaImportacaoProcesso, string>
> & { linha: number };

export type DestinoMapeamentoProcesso =
  | ColunaImportacaoProcesso
  | 'clienteDocumento';

export const CAMPOS_ALVO_PROCESSOS: ReadonlyArray<{
  chave: DestinoMapeamentoProcesso;
  rotulo: string;
  obrigatorio?: boolean;
  documentoFlexivel?: boolean;
}> = [
  { chave: 'numero', rotulo: 'Número do processo', obrigatorio: true },
  { chave: 'titulo', rotulo: 'Título' },
  { chave: 'status', rotulo: 'Status' },
  { chave: 'prioridade', rotulo: 'Prioridade' },
  { chave: 'prazo', rotulo: 'Prazo' },
  { chave: 'descricao', rotulo: 'Descrição' },
  { chave: 'clienteCpf', rotulo: 'CPF do cliente' },
  { chave: 'clienteCnpj', rotulo: 'CNPJ do cliente' },
  {
    chave: 'clienteDocumento',
    rotulo: 'Documento do cliente (CPF ou CNPJ)',
    documentoFlexivel: true,
  },
  { chave: 'tags', rotulo: 'Tags' },
];

const ALIASES: Record<string, DestinoMapeamentoProcesso> = {
  numero: 'numero',
  'numero processo': 'numero',
  'n processo': 'numero',
  'n do processo': 'numero',
  'num processo': 'numero',
  'numero do processo': 'numero',
  'numero cnj': 'numero',
  processo: 'numero',
  cnj: 'numero',
  'cod processo': 'numero',
  titulo: 'titulo',
  title: 'titulo',
  assunto: 'titulo',
  'nome do caso': 'titulo',
  'titulo do caso': 'titulo',
  status: 'status',
  situacao: 'status',
  situação: 'status',
  fase: 'status',
  prioridade: 'prioridade',
  priority: 'prioridade',
  urgencia: 'prioridade',
  prazo: 'prazo',
  'data prazo': 'prazo',
  vencimento: 'prazo',
  'data vencimento': 'prazo',
  'proximo prazo': 'prazo',
  descricao: 'descricao',
  descrição: 'descricao',
  observacoes: 'descricao',
  resumo: 'descricao',
  clientecpf: 'clienteCpf',
  'cliente cpf': 'clienteCpf',
  cpf: 'clienteCpf',
  'cpf cliente': 'clienteCpf',
  'cpf do cliente': 'clienteCpf',
  clientecnjp: 'clienteCnpj',
  clientecnpj: 'clienteCnpj',
  'cliente cnpj': 'clienteCnpj',
  cnpj: 'clienteCnpj',
  'cnpj cliente': 'clienteCnpj',
  'cnpj do cliente': 'clienteCnpj',
  clienteDocumento: 'clienteDocumento',
  'documento cliente': 'clienteDocumento',
  'cpf/cnpj': 'clienteDocumento',
  'cpf cnpj cliente': 'clienteDocumento',
  documento: 'clienteDocumento',
  tags: 'tags',
  tag: 'tags',
  etiquetas: 'tags',
  areas: 'tags',
};

export const MODELO_CSV_PROCESSOS =
  '\uFEFF' +
  [
    [
      'numero',
      'titulo',
      'status',
      'prioridade',
      'prazo',
      'descricao',
      'clienteCpf',
      'clienteCnpj',
      'tags',
    ].join(';'),
    [
      '1004521-38.2025.5.02.0001',
      'Reclamacao trabalhista',
      'Audiencia marcada',
      'Alta',
      '25/08/2026',
      'Exemplo PF — apague e use o CPF do cliente ja importado',
      '529.982.247-25',
      '',
      'trabalhista',
    ].join(';'),
    [
      '1018834-72.2026.8.26.0100',
      'Cobranca de duplicatas',
      'Em andamento',
      'Media',
      '22/08/2026',
      'Exemplo PJ — apague e use o CNPJ do cliente ja importado',
      '',
      '45.218.903/0001-81',
      'civel',
    ].join(';'),
  ].join('\r\n');

function normalizarCabecalho(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function sugerirColunaProcesso(
  cabecalho: string,
): DestinoMapeamentoProcesso | null {
  const chave = normalizarCabecalho(cabecalho).replace(/[_\s]+/g, ' ').trim();
  const semEspaco = chave.replace(/\s+/g, '');
  return ALIASES[chave] || ALIASES[semEspaco] || null;
}

export function linhasDeCsvProcessos(texto: string): LinhaImportacaoProcesso[] {
  return linhasDeTabelaProcessos(parsearCsv(texto));
}

export function linhasDeTabelaProcessos(
  tabela: string[][],
): LinhaImportacaoProcesso[] {
  if (tabela.length === 0) return [];

  const cabecalhos = tabela[0].map((h) => sugerirColunaProcesso(h));
  if (!cabecalhos.includes('numero')) {
    throw new Error(
      'Arquivo sem coluna de número do processo. Use o mapeamento de colunas ou baixe o modelo Excel.',
    );
  }
  const temDoc =
    cabecalhos.includes('clienteCpf') ||
    cabecalhos.includes('clienteCnpj') ||
    cabecalhos.includes('clienteDocumento');
  if (!temDoc) {
    throw new Error(
      'Arquivo precisa de CPF/CNPJ do cliente. Use o mapeamento de colunas.',
    );
  }

  const resultado: LinhaImportacaoProcesso[] = [];
  for (let i = 1; i < tabela.length; i++) {
    const cells = tabela[i];
    const linha: LinhaImportacaoProcesso = { linha: i + 1 };
    let temAlgo = false;
    for (let c = 0; c < cabecalhos.length; c++) {
      const col = cabecalhos[c];
      if (!col) continue;
      const valor = (cells[c] ?? '').trim();
      if (!valor) continue;
      if (col === 'clienteDocumento') {
        const d = valor.replace(/\D/g, '');
        if (d.length <= 11) linha.clienteCpf = valor;
        else linha.clienteCnpj = valor;
      } else {
        linha[col] = valor;
      }
      temAlgo = true;
    }
    if (temAlgo) resultado.push(linha);
  }
  return resultado;
}

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizarStatusProcesso(raw?: string): string | null {
  if (!raw?.trim()) return 'Em andamento';
  const alvo = semAcento(raw);
  const hit = PROCESSO_STATUS.find((s) => semAcento(s) === alvo);
  return hit ?? null;
}

export function parsearTagsCsv(raw?: string): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const tags = raw
    .split(/[|;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
}
