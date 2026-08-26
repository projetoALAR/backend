import * as ExcelJS from 'exceljs';
import { linhasDeTabelaClientes } from '../clientes/clientes-importacao.util';
import { linhasDeTabelaProcessos } from '../processos/processos-importacao.util';
import { PROCESSO_STATUS } from '../processos/processos.dto';
import {
  lerPlanilhaComoTabela,
  montarModeloClientesXlsx,
  montarModeloProcessosXlsx,
} from './planilha-importacao.util';

describe('planilha-importacao.util', () => {
  it('gera modelo de clientes com abas Instruções, Dados e Exemplos', async () => {
    const buffer = await montarModeloClientesXlsx();
    expect(buffer.length).toBeGreaterThan(1000);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(wb.getWorksheet('Instruções')).toBeTruthy();
    expect(wb.getWorksheet('Dados')).toBeTruthy();
    expect(wb.getWorksheet('Exemplos')).toBeTruthy();
  });

  it('modelo de clientes com exemplos na aba Dados importa 2 linhas', async () => {
    const buffer = await montarModeloClientesXlsx();
    const filled = await withExemplosNaAbaDados(buffer);
    const tabela = await lerPlanilhaComoTabela(filled);
    const linhas = linhasDeTabelaClientes(tabela);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].cpf).toContain('529');
    expect(linhas[1].cnpj).toContain('45.218');
  });

  it('modelo de casos com exemplos na aba Dados importa 2 linhas', async () => {
    const buffer = await montarModeloProcessosXlsx(PROCESSO_STATUS);
    const filled = await withExemplosNaAbaDados(buffer);
    const tabela = await lerPlanilhaComoTabela(filled);
    const linhas = linhasDeTabelaProcessos(tabela);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].clienteCpf).toBeTruthy();
    expect(linhas[1].clienteCnpj).toBeTruthy();
  });
});

/** Copia linhas da aba Exemplos para Dados (simula usuário preenchendo). */
async function withExemplosNaAbaDados(buffer: Buffer): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const dados = wb.getWorksheet('Dados');
  const exemplos = wb.getWorksheet('Exemplos');
  if (!dados || !exemplos) throw new Error('Abas ausentes');

  exemplos.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      vals[col - 1] = cell.value == null ? '' : String(cell.value);
    });
    if (!vals.some((v) => String(v).trim())) return;
    if (String(vals[0] || '').includes('só referência')) return;
    dados.addRow(vals);
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
