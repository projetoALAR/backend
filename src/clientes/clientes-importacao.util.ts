/** Colunas aceitas no CSV de importação de clientes (pt-BR). */
export const COLUNAS_IMPORTACAO_CLIENTES = [
  'nome',
  'tipo',
  'cpf',
  'cnpj',
  'nomeFantasia',
  'rg',
  'email',
  'telefone',
  'endereco',
  'cidade',
  'uf',
  'cep',
  'observacoes',
] as const;

export type ColunaImportacaoCliente =
  (typeof COLUNAS_IMPORTACAO_CLIENTES)[number];

export type LinhaImportacaoCliente = Partial<
  Record<ColunaImportacaoCliente, string>
> & { linha: number };

/** Inclui “documento” (CPF ou CNPJ numa coluna só). */
export type DestinoMapeamentoCliente = ColunaImportacaoCliente | 'documento';

export const CAMPOS_ALVO_CLIENTES: ReadonlyArray<{
  chave: DestinoMapeamentoCliente;
  rotulo: string;
  obrigatorio?: boolean;
  documentoFlexivel?: boolean;
}> = [
  { chave: 'nome', rotulo: 'Nome / Razão social', obrigatorio: true },
  { chave: 'tipo', rotulo: 'Tipo (PF/PJ)' },
  { chave: 'cpf', rotulo: 'CPF' },
  { chave: 'cnpj', rotulo: 'CNPJ' },
  {
    chave: 'documento',
    rotulo: 'Documento (CPF ou CNPJ na mesma coluna)',
    documentoFlexivel: true,
  },
  { chave: 'nomeFantasia', rotulo: 'Nome fantasia' },
  { chave: 'rg', rotulo: 'RG' },
  { chave: 'email', rotulo: 'E-mail' },
  { chave: 'telefone', rotulo: 'Telefone' },
  { chave: 'endereco', rotulo: 'Endereço' },
  { chave: 'cidade', rotulo: 'Cidade' },
  { chave: 'uf', rotulo: 'UF' },
  { chave: 'cep', rotulo: 'CEP' },
  { chave: 'observacoes', rotulo: 'Observações' },
];

const ALIASES: Record<string, DestinoMapeamentoCliente> = {
  nome: 'nome',
  name: 'nome',
  'razao social': 'nome',
  razaosocial: 'nome',
  'nome completo': 'nome',
  'nome do cliente': 'nome',
  'nome cliente': 'nome',
  cliente: 'nome',
  titular: 'nome',
  parte: 'nome',
  autor: 'nome',
  tipo: 'tipo',
  'tipo pessoa': 'tipo',
  'tipo de pessoa': 'tipo',
  cpf: 'cpf',
  cnpj: 'cnpj',
  documento: 'documento',
  'cpf/cnpj': 'documento',
  'cpf cnpj': 'documento',
  'cpf ou cnpj': 'documento',
  doc: 'documento',
  'n documento': 'documento',
  'numero documento': 'documento',
  nomefantasia: 'nomeFantasia',
  'nome fantasia': 'nomeFantasia',
  fantasia: 'nomeFantasia',
  rg: 'rg',
  email: 'email',
  e_mail: 'email',
  'e-mail': 'email',
  'email cliente': 'email',
  telefone: 'telefone',
  phone: 'telefone',
  celular: 'telefone',
  fone: 'telefone',
  whatsapp: 'telefone',
  endereco: 'endereco',
  endereço: 'endereco',
  address: 'endereco',
  logradouro: 'endereco',
  cidade: 'cidade',
  city: 'cidade',
  municipio: 'cidade',
  uf: 'uf',
  estado: 'uf',
  cep: 'cep',
  observacoes: 'observacoes',
  observações: 'observacoes',
  obs: 'observacoes',
  anotacoes: 'observacoes',
};

export const MODELO_CSV_CLIENTES =
  '\uFEFF' +
  [
    COLUNAS_IMPORTACAO_CLIENTES.join(';'),
    [
      'Marina Souza Lima',
      'PF',
      '529.982.247-25',
      '',
      '',
      '12.345.678-9',
      'marina.demo@alar.dev',
      '(11) 98888-7777',
      'Rua das Flores 100',
      'Sao Paulo',
      'SP',
      '01310-100',
      'Exemplo pessoa fisica — apague esta linha',
    ].join(';'),
    [
      'Horizonte Atacado Ltda',
      'PJ',
      '',
      '45.218.903/0001-81',
      'Horizonte Atacado',
      '',
      'juridico@horizonte.demo',
      '(11) 3278-4410',
      'Av do Estado 1880',
      'Sao Paulo',
      'SP',
      '03007-000',
      'Exemplo pessoa juridica — apague esta linha',
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

export function sugerirColunaCliente(
  cabecalho: string,
): DestinoMapeamentoCliente | null {
  const chave = normalizarCabecalho(cabecalho).replace(/[_\s]+/g, ' ').trim();
  const semEspaco = chave.replace(/\s+/g, '');
  return ALIASES[chave] || ALIASES[semEspaco] || null;
}

/** Parser CSV simples com aspas e vírgula/ponto-e-vírgula. */
export function parsearCsv(texto: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const input = texto.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',' || ch === ';') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }

  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function linhasDeCsv(texto: string): LinhaImportacaoCliente[] {
  return linhasDeTabelaClientes(parsearCsv(texto));
}

export function linhasDeTabelaClientes(
  tabela: string[][],
): LinhaImportacaoCliente[] {
  if (tabela.length === 0) return [];

  const cabecalhos = tabela[0].map((h) => sugerirColunaCliente(h));
  if (!cabecalhos.includes('nome')) {
    throw new Error(
      'Arquivo sem coluna "Nome". Use o mapeamento de colunas ou baixe o modelo Excel.',
    );
  }

  const resultado: LinhaImportacaoCliente[] = [];
  for (let i = 1; i < tabela.length; i++) {
    const cells = tabela[i];
    const linha: LinhaImportacaoCliente = { linha: i + 1 };
    let temAlgo = false;
    for (let c = 0; c < cabecalhos.length; c++) {
      const col = cabecalhos[c];
      if (!col) continue;
      const valor = (cells[c] ?? '').trim();
      if (!valor) continue;
      if (col === 'documento') {
        const d = valor.replace(/\D/g, '');
        if (d.length <= 11) linha.cpf = valor;
        else linha.cnpj = valor;
      } else {
        linha[col] = valor;
      }
      temAlgo = true;
    }
    if (temAlgo) resultado.push(linha);
  }
  return resultado;
}
