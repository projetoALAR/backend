/**
 * Contrato do provider de andamentos processuais.
 *
 * O schema Prisma (`Andamento`) e o `AndamentosService` dependem apenas deste
 * contrato — trocar DataJud por Jusbrasil/Escavador/Judit.io = implementar
 * outra classe e registrar no `AndamentosModule` no lugar de `DatajudService`.
 */

export const ANDAMENTOS_PROVIDER = Symbol('ANDAMENTOS_PROVIDER');

/** Movimento já normalizado pelo provider (independente do formato da API). */
export type AndamentoProviderMovimento = {
  data: Date;
  descricao: string;
  codigoMovimento: number | null;
  /** Payload bruto do provider, persistido em `Andamento.origem` para auditoria */
  origem: unknown;
};

export type AndamentosConsultaSucesso = {
  ok: true;
  /** Sigla/cache opcional do tribunal (ex.: tjsp); providers comerciais podem omitir */
  tribunalSigla?: string | null;
  movimentos: AndamentoProviderMovimento[];
};

export type AndamentosConsultaFalha = {
  ok: false;
  motivo:
    | 'tribunal_nao_mapeado'
    | 'nao_encontrado'
    | 'sem_api_key'
    | 'erro'
    | 'cnj_invalido';
  mensagem: string;
};

export type AndamentosConsultaResultado =
  AndamentosConsultaSucesso | AndamentosConsultaFalha;

export interface AndamentosProvider {
  consultarPorNumero(
    numeroProcesso: string,
    tribunalSiglaCache?: string | null,
  ): Promise<AndamentosConsultaResultado>;
}
