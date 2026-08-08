/**
 * Glossário estático dos códigos de movimento mais comuns da TPU-CNJ.
 * Explicações em linguagem simples para a timeline de andamentos.
 * Fonte: Tabelas Processuais Unificadas (CNJ) — cobertura parcial dos códigos frequentes.
 */

const GLOSSARIO_MOVIMENTO: Record<number, string> = {
  26: 'O processo foi registrado e encaminhado para uma vara.',
  51: 'O processo foi encaminhado ao juiz para decisão.',
  60: 'Foi expedido um documento oficial (ofício, mandado, carta etc.).',
  85: 'Foi protocolada uma petição no processo.',
  92: 'Houve publicação de ato ou decisão no diário oficial ou meio equivalente.',
  110: 'O juiz proferiu um despacho (ordem ou determinação processual).',
  123: 'Os autos foram remetidos a outro órgão ou instância.',
  132: 'O processo foi redistribuído para outra vara ou juízo.',
  193: 'Foi juntado um documento aos autos.',
  196: 'Foi juntada uma petição aos autos.',
  218: 'Foi designada ou realizada uma audiência.',
  246: 'O processo recebeu baixa (encerramento do trâmite nesta unidade).',
  418: 'Os autos foram liberados para vista (consulta pelas partes).',
  581: 'Iniciou-se a fase de execução da decisão.',
  848: 'Foi determinada ou cumprida a citação de uma das partes.',
  971: 'Foi proferida sentença (decisão que julga o mérito ou encerra a fase de conhecimento).',
  978: 'Foi proferida uma decisão interlocutória (não é a sentença final).',
  1051: 'A decisão transitou em julgado — não cabe mais recurso ordinário.',
  1061: 'O processo foi arquivado.',
  11383: 'Os autos foram conclusos ao juiz para despacho.',
};

/**
 * Retorna explicação amigável do código TPU, ou null se desconhecido.
 * Não chama IA — apenas o mapa estático (sem custo/latência na listagem).
 */
export function explicarMovimento(
  codigo: number | null | undefined,
  descricao: string,
): string | null {
  // `descricao` reservada para heurística futura por rótulo (sem IA na listagem).
  void descricao;
  if (codigo == null || !Number.isFinite(codigo)) {
    return null;
  }
  return GLOSSARIO_MOVIMENTO[codigo] ?? null;
}

/** Expõe o glossário para testes e documentação. */
export function listarCodigosGlossario(): number[] {
  return Object.keys(GLOSSARIO_MOVIMENTO).map(Number);
}
