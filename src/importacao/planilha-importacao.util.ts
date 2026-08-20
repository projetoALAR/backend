import * as ExcelJS from 'exceljs';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function ehArquivoPlanilha(
  nomeArquivo: string,
  mime?: string,
): boolean {
  const nome = (nomeArquivo || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    nome.endsWith('.xlsx') ||
    nome.endsWith('.xls') ||
    m.includes('spreadsheet') ||
    m === XLSX_MIME ||
    m === 'application/vnd.ms-excel'
  );
}

export function ehArquivoCsv(nomeArquivo: string, mime?: string): boolean {
  const nome = (nomeArquivo || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  return (
    nome.endsWith('.csv') ||
    m.includes('csv') ||
    m === 'text/plain' ||
    m === 'application/vnd.ms-excel'
  );
}

function celulaParaTexto(valor: ExcelJS.CellValue): string {
  if (valor == null || valor === '') return '';
  if (valor instanceof Date) {
    const d = valor.getUTCDate().toString().padStart(2, '0');
    const m = (valor.getUTCMonth() + 1).toString().padStart(2, '0');
    const y = valor.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }
  if (typeof valor === 'object') {
    if ('text' in valor && typeof valor.text === 'string') return valor.text;
    if ('result' in valor && valor.result != null) {
      return celulaParaTexto(valor.result as ExcelJS.CellValue);
    }
    if ('richText' in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((p) => p.text).join('');
    }
  }
  return String(valor).trim();
}

/**
 * Lê a aba "Dados" (ou a primeira com conteúdo) e devolve matriz de strings.
 */
export async function lerPlanilhaComoTabela(
  buffer: Buffer,
): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const preferidas = ['Dados', 'dados', 'Planilha1', 'Sheet1'];
  let sheet =
    preferidas.map((n) => wb.getWorksheet(n)).find(Boolean) ?? undefined;
  if (!sheet) {
    sheet = wb.worksheets.find((s) => s.name !== 'Instruções' && s.name !== 'Instrucoes' && s.name !== 'Exemplos');
  }
  if (!sheet) sheet = wb.worksheets[0];
  if (!sheet) throw new Error('Planilha vazia.');

  const tabela: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = celulaParaTexto(cell.value);
    });
    // preenche buracos
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] == null) cells[i] = '';
    }
    if (cells.some((c) => c.trim())) tabela.push(cells);
  });
  return tabela;
}

type ColunaModelo = {
  chave: string;
  titulo: string;
  largura: number;
  lista?: string[];
};

async function montarWorkbookModelo(opcoes: {
  tituloArquivo: string;
  instrucoes: string[];
  colunas: ColunaModelo[];
  exemplos: string[][];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Alar';
  wb.created = new Date();

  const instr = wb.addWorksheet('Instruções', {
    properties: { defaultRowHeight: 18 },
  });
  instr.getColumn(1).width = 100;
  instr.getCell('A1').value = opcoes.tituloArquivo;
  instr.getCell('A1').font = { bold: true, size: 14 };
  opcoes.instrucoes.forEach((linha, i) => {
    instr.getCell(`A${i + 3}`).value = linha;
    instr.getCell(`A${i + 3}`).alignment = { wrapText: true };
  });

  const dados = wb.addWorksheet('Dados');
  opcoes.colunas.forEach((col, i) => {
    const cell = dados.getCell(1, i + 1);
    cell.value = col.titulo;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    dados.getColumn(i + 1).width = col.largura;
  });
  dados.getRow(1).height = 22;
  dados.views = [{ state: 'frozen', ySplit: 1 }];

  // Validação de lista (dropdown) nas primeiras 500 linhas de dados
  opcoes.colunas.forEach((col, i) => {
    if (!col.lista?.length) return;
    const colLetter = dados.getColumn(i + 1).letter;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dados as any).dataValidations.add(`${colLetter}2:${colLetter}501`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${col.lista.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: `Use um dos valores: ${col.lista.join(', ')}`,
    });
  });

  const exemplos = wb.addWorksheet('Exemplos');
  opcoes.colunas.forEach((col, i) => {
    const cell = exemplos.getCell(1, i + 1);
    cell.value = col.titulo;
    cell.font = { bold: true };
    exemplos.getColumn(i + 1).width = col.largura;
  });
  opcoes.exemplos.forEach((linha, r) => {
    linha.forEach((valor, c) => {
      exemplos.getCell(r + 2, c + 1).value = valor;
    });
  });
  exemplos.getCell(opcoes.exemplos.length + 3, 1).value =
    'Estas linhas são só referência. Preencha a aba Dados e envie o arquivo .xlsx.';
  exemplos.getCell(opcoes.exemplos.length + 3, 1).font = { italic: true };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function montarModeloClientesXlsx(): Promise<Buffer> {
  return montarWorkbookModelo({
    tituloArquivo: 'Modelo de importação — Clientes (Alar)',
    instrucoes: [
      '1. Vá na aba Dados e preencha uma linha por cliente (até 500).',
      '2. Tipo: escolha PF (pessoa física) ou PJ (pessoa jurídica) na lista.',
      '3. PF: preencha CPF. PJ: preencha CNPJ e, se quiser, Nome fantasia.',
      '4. A aba Exemplos mostra como fica — não envie só os exemplos.',
      '5. Salve o arquivo .xlsx e use Importar na tela de Clientes.',
      '6. Também aceitamos .csv (separador ;), se preferir.',
    ],
    colunas: [
      { chave: 'nome', titulo: 'Nome', largura: 28 },
      { chave: 'tipo', titulo: 'Tipo', largura: 8, lista: ['PF', 'PJ'] },
      { chave: 'cpf', titulo: 'CPF', largura: 16 },
      { chave: 'cnpj', titulo: 'CNPJ', largura: 18 },
      { chave: 'nomeFantasia', titulo: 'Nome fantasia', largura: 22 },
      { chave: 'rg', titulo: 'RG', largura: 14 },
      { chave: 'email', titulo: 'Email', largura: 28 },
      { chave: 'telefone', titulo: 'Telefone', largura: 16 },
      { chave: 'endereco', titulo: 'Endereco', largura: 28 },
      { chave: 'cidade', titulo: 'Cidade', largura: 16 },
      { chave: 'uf', titulo: 'UF', largura: 6 },
      { chave: 'cep', titulo: 'CEP', largura: 12 },
      { chave: 'observacoes', titulo: 'Observacoes', largura: 32 },
    ],
    exemplos: [
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
        'Exemplo PF',
      ],
      [
        'Horizonte Atacado Ltda',
        'PJ',
        '',
        '45.218.903/0001-00',
        'Horizonte Atacado',
        '',
        'juridico@horizonte.demo',
        '(11) 3278-4410',
        'Av do Estado 1880',
        'Sao Paulo',
        'SP',
        '03007-000',
        'Exemplo PJ',
      ],
    ],
  });
}

export async function montarModeloProcessosXlsx(
  statusLista: readonly string[],
): Promise<Buffer> {
  return montarWorkbookModelo({
    tituloArquivo: 'Modelo de importação — Casos (Alar)',
    instrucoes: [
      '1. Importe os clientes antes (CPF/CNPJ precisam existir no sistema).',
      '2. Na aba Dados, preencha uma linha por caso (até 500).',
      '3. Informe CPF do cliente OU CNPJ do cliente (o mesmo já cadastrado).',
      '4. Status e prioridade têm lista — escolha um valor válido.',
      '5. Prazo: use DD/MM/AAAA (ex.: 25/08/2026).',
      '6. Tags: separe com | (ex.: trabalhista|audiencia).',
      '7. Salve o .xlsx e use Importar na tela de Casos. CSV com ; também funciona.',
    ],
    colunas: [
      { chave: 'numero', titulo: 'Numero do processo', largura: 26 },
      { chave: 'titulo', titulo: 'Titulo', largura: 28 },
      {
        chave: 'status',
        titulo: 'Status',
        largura: 18,
        lista: [...statusLista],
      },
      {
        chave: 'prioridade',
        titulo: 'Prioridade',
        largura: 12,
        lista: ['Alta', 'Media', 'Baixa'],
      },
      { chave: 'prazo', titulo: 'Prazo', largura: 12 },
      { chave: 'descricao', titulo: 'Descricao', largura: 32 },
      { chave: 'clienteCpf', titulo: 'CPF do cliente', largura: 16 },
      { chave: 'clienteCnpj', titulo: 'CNPJ do cliente', largura: 18 },
      { chave: 'tags', titulo: 'Tags', largura: 18 },
    ],
    exemplos: [
      [
        '1004521-38.2025.5.02.0001',
        'Reclamacao trabalhista',
        'Audiencia marcada',
        'Alta',
        '25/08/2026',
        'Exemplo vinculado ao CPF',
        '529.982.247-25',
        '',
        'trabalhista',
      ],
      [
        '1018834-72.2026.8.26.0100',
        'Cobranca de duplicatas',
        'Em andamento',
        'Media',
        '22/08/2026',
        'Exemplo vinculado ao CNPJ',
        '',
        '45.218.903/0001-00',
        'civel',
      ],
    ],
  });
}

export async function montarModeloEquipeXlsx(): Promise<Buffer> {
  return montarWorkbookModelo({
    tituloArquivo: 'Modelo de importação — Equipe (Alar)',
    instrucoes: [
      '1. Preencha a aba Dados (até 100 membros por arquivo).',
      '2. Papel: ADMIN, ADVOGADO ou ASSISTENTE (lista na coluna).',
      '3. Senha: por linha OU informe uma senha temporária padrão na tela de importação.',
      '4. Senha forte: mín. 10 caracteres, com maiúscula, minúscula e número.',
      '5. Peça que cada pessoa troque a senha no primeiro acesso.',
      '6. A aba Exemplos é só referência.',
    ],
    colunas: [
      { chave: 'nome', titulo: 'Nome', largura: 28 },
      { chave: 'email', titulo: 'Email', largura: 30 },
      { chave: 'cargo', titulo: 'Cargo', largura: 18 },
      {
        chave: 'role',
        titulo: 'Papel',
        largura: 14,
        lista: ['ADMIN', 'ADVOGADO', 'ASSISTENTE'],
      },
      { chave: 'senha', titulo: 'Senha', largura: 18 },
      {
        chave: 'status',
        titulo: 'Status',
        largura: 12,
        lista: ['active', 'inactive'],
      },
    ],
    exemplos: [
      [
        'Ana Ribeiro',
        'ana.ribeiro@escritorio.demo',
        'Advogada associada',
        'ADVOGADO',
        'AlarTrocar123',
        'active',
      ],
      [
        'Pedro Alves',
        'pedro.alves@escritorio.demo',
        'Assistente juridico',
        'ASSISTENTE',
        'AlarTrocar123',
        'active',
      ],
    ],
  });
}
