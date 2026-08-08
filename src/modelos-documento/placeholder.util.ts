/**
 * Placeholders suportados em modelos de documento.
 * Usados por `preencherModelo` e pela futura geração de rascunhos via IA.
 */
export const PLACEHOLDERS_DISPONIVEIS = [
  '{{cliente.nome}}',
  '{{cliente.cpf}}',
  '{{cliente.email}}',
  '{{cliente.telefone}}',
  '{{processo.numero}}',
  '{{processo.titulo}}',
  '{{processo.status}}',
  '{{processo.descricao}}',
  '{{data.hoje}}',
] as const;

export type PlaceholderDisponivel = (typeof PLACEHOLDERS_DISPONIVEIS)[number];

export type ClienteDados = {
  nome?: string | null;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
};

export type ProcessoDados = {
  numero?: string | null;
  titulo?: string | null;
  status?: string | null;
  descricao?: string | null;
};

export type DadosPreenchimento = {
  cliente?: ClienteDados;
  processo?: ProcessoDados;
  /** Sobrescreve a data de hoje (útil em testes). */
  hoje?: Date;
};

function valorOuPendente(
  valor: string | null | undefined,
  chave: string,
): string {
  const texto = valor?.trim();
  if (texto) return texto;
  return `[PENDENTE: ${chave}]`;
}

/**
 * Substitui placeholders `{{...}}` pelos dados do cliente/processo.
 * Dados ausentes viram `[PENDENTE: chave]` para o usuário completar manualmente.
 */
export function preencherModelo(
  conteudo: string,
  dados: DadosPreenchimento = {},
): string {
  const hoje = dados.hoje ?? new Date();
  const dataHoje = hoje.toLocaleDateString('pt-BR');

  const mapa: Record<string, string> = {
    '{{cliente.nome}}': valorOuPendente(dados.cliente?.nome, 'cliente.nome'),
    '{{cliente.cpf}}': valorOuPendente(dados.cliente?.cpf, 'cliente.cpf'),
    '{{cliente.email}}': valorOuPendente(dados.cliente?.email, 'cliente.email'),
    '{{cliente.telefone}}': valorOuPendente(
      dados.cliente?.telefone,
      'cliente.telefone',
    ),
    '{{processo.numero}}': valorOuPendente(
      dados.processo?.numero,
      'processo.numero',
    ),
    '{{processo.titulo}}': valorOuPendente(
      dados.processo?.titulo,
      'processo.titulo',
    ),
    '{{processo.status}}': valorOuPendente(
      dados.processo?.status,
      'processo.status',
    ),
    '{{processo.descricao}}': valorOuPendente(
      dados.processo?.descricao,
      'processo.descricao',
    ),
    '{{data.hoje}}': dataHoje,
  };

  let resultado = conteudo;
  for (const [placeholder, valor] of Object.entries(mapa)) {
    // Substitui todas as ocorrências (split/join evita regex global)
    if (resultado.includes(placeholder)) {
      resultado = resultado.split(placeholder).join(valor);
    }
  }
  return resultado;
}
