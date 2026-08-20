import {
  aplicarMapeamento,
  montarPreview,
  mapeamentoDasSugestoes,
  validarMapeamento,
} from './importacao-mapeamento.util';
import { sugerirColunaCliente } from '../clientes/clientes-importacao.util';
import { CAMPOS_ALVO_CLIENTES } from '../clientes/clientes-importacao.util';
import { CAMPOS_ALVO_PROCESSOS } from '../processos/processos-importacao.util';

describe('importacao-mapeamento.util', () => {
  it('sugere colunas de planilha genérica e aplica mapeamento', () => {
    const tabela = [
      ['Razão Social', 'CPF/CNPJ', 'E-mail', 'Cidade'],
      ['Ana Silva', '390.533.447-05', 'ana@x.com', 'SP'],
      ['Beta Ltda', '12.345.678/0001-95', 'b@x.com', 'RJ'],
    ];
    const preview = montarPreview(
      tabela,
      [...CAMPOS_ALVO_CLIENTES],
      (h) => sugerirColunaCliente(h),
    );
    expect(preview.sugestoes[0]).toBe('nome');
    expect(preview.sugestoes[1]).toBe('documento');
    expect(preview.totalLinhas).toBe(2);

    const map = mapeamentoDasSugestoes(preview.sugestoes);
    const linhas = aplicarMapeamento<{
      linha: number;
      nome?: string;
      cpf?: string;
      cnpj?: string;
      email?: string;
    }>(tabela, map, { documentoPara: { cpf: 'cpf', cnpj: 'cnpj' } });

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      nome: 'Ana Silva',
      cpf: '390.533.447-05',
      email: 'ana@x.com',
    });
    expect(linhas[1]).toMatchObject({
      nome: 'Beta Ltda',
      cnpj: '12.345.678/0001-95',
    });
  });

  it('validarMapeamento exige campos obrigatórios', () => {
    expect(
      validarMapeamento({ '0': 'email' }, [...CAMPOS_ALVO_CLIENTES]),
    ).toMatch(/Nome/);
    expect(
      validarMapeamento({ '0': 'nome' }, [...CAMPOS_ALVO_CLIENTES]),
    ).toBeNull();
  });

  it('validarMapeamento exigeUmDe para documento do cliente no caso', () => {
    const op = {
      exigirUmDe: [
        {
          chaves: ['clienteCpf', 'clienteCnpj', 'clienteDocumento'],
          rotulo: 'CPF, CNPJ ou Documento do cliente',
        },
      ],
    };
    expect(
      validarMapeamento({ '0': 'numero' }, [...CAMPOS_ALVO_PROCESSOS], op),
    ).toMatch(/CPF, CNPJ ou Documento/);
    expect(
      validarMapeamento(
        { '0': 'numero', '1': 'clienteDocumento' },
        [...CAMPOS_ALVO_PROCESSOS],
        op,
      ),
    ).toBeNull();
  });
});
