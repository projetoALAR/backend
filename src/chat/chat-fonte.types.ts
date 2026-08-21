export type ChatFonteTipo = 'texto' | 'pdf' | 'imagem' | 'outro';

export type ChatFonte = {
  documentoId: string;
  nome: string;
  trecho: string | null;
  tipo: ChatFonteTipo;
};

export function extrairTrechoRelevante(
  texto: string,
  pergunta: string,
  max = 280,
): string {
  const trimmed = texto.trim();
  if (!trimmed) return '';
  if (trimmed.length <= max) return trimmed;

  const palavras = pergunta
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  if (palavras.length === 0) {
    return `${trimmed.slice(0, max)}…`;
  }

  const lower = trimmed.toLowerCase();
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < lower.length; i += 80) {
    const chunk = lower.slice(i, i + 400);
    const score = palavras.reduce((s, w) => s + (chunk.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const start = Math.max(0, bestIdx - 20);
  const slice = trimmed.slice(start, start + max).trim();
  return slice.length < trimmed.length ? `${slice}…` : slice;
}

export function filtrarFontesCitadas(
  resposta: string,
  fontes: ChatFonte[],
): ChatFonte[] {
  if (fontes.length === 0) return [];

  const respostaLower = resposta.toLowerCase();
  // Só fontes citadas pelo nome (ex.: [contrato.pdf]) — sem fallback genérico.
  const mencionadas = fontes.filter((f) =>
    respostaLower.includes(f.nome.toLowerCase()),
  );

  const map = new Map<string, ChatFonte>();
  for (const f of mencionadas) {
    map.set(f.documentoId, f);
  }
  return [...map.values()].slice(0, 6);
}
