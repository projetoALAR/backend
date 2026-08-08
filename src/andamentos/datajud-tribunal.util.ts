/**
 * Resolve a sigla do índice DataJud a partir do número CNJ.
 *
 * Formato oficial (Resolução CNJ nº 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
 * Com 20 dígitos: posições 0–6 sequencial, 7–8 DV, 9–12 ano, 13 = J, 14–15 = TR, 16–19 origem.
 *
 * Segmento J (campo 13):
 *   1 STF · 2 CNJ · 3 STJ · 4 Justiça Federal · 5 Justiça do Trabalho
 *   6 Justiça Eleitoral · 7 Justiça Militar da União
 *   8 Justiça Estadual / DF · 9 Justiça Militar Estadual
 *
 * Mapeamento TR → alias DataJud (`api_publica_{sigla}`), conforme
 * https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
 */

/** UFs da Justiça Estadual (J=8) e Eleitoral (J=6), códigos TR 01–27. */
const UF_POR_TR: Record<string, string> = {
  '01': 'ac',
  '02': 'al',
  '03': 'ap',
  '04': 'am',
  '05': 'ba',
  '06': 'ce',
  '07': 'df',
  '08': 'es',
  '09': 'go',
  '10': 'ma',
  '11': 'mt',
  '12': 'ms',
  '13': 'mg',
  '14': 'pa',
  '15': 'pb',
  '16': 'pr',
  '17': 'pe',
  '18': 'pi',
  '19': 'rj',
  '20': 'rn',
  '21': 'rs',
  '22': 'ro',
  '23': 'rr',
  '24': 'sc',
  '25': 'se',
  '26': 'sp',
  '27': 'to',
};

/** Justiça Militar Estadual (J=9): apenas MG, RS e SP. */
const TJM_POR_TR: Record<string, string> = {
  '13': 'tjmmg',
  '21': 'tjmrs',
  '26': 'tjmsp',
};

/** Remove pontuação e valida 20 dígitos do número CNJ. */
export function normalizarNumeroCnj(numero: string): string | null {
  const digits = numero.replace(/\D/g, '');
  return digits.length === 20 ? digits : null;
}

/**
 * Extrai J e TR do número CNJ e devolve a sigla do índice DataJud
 * (ex.: `tjsp`, `trf1`, `trt2`, `stj`) ou `null` se não mapeado.
 */
export function resolverTribunalSigla(numeroProcesso: string): string | null {
  const digits = normalizarNumeroCnj(numeroProcesso);
  if (!digits) return null;

  const j = digits[13];
  const tr = digits.slice(14, 16);

  switch (j) {
    case '1':
      // STF não possui índice na API pública do DataJud
      return null;
    case '2':
      // CNJ não possui índice público
      return null;
    case '3':
      return tr === '00' ? 'stj' : null;
    case '4': {
      // Justiça Federal: TRF 01–06; CJF (90) sem índice público
      if (tr === '90') return null;
      const n = Number(tr);
      if (n >= 1 && n <= 6) return `trf${n}`;
      return null;
    }
    case '5': {
      // Justiça do Trabalho: TST (00), TRT 01–24; CSJT (90) sem índice
      if (tr === '00') return 'tst';
      if (tr === '90') return null;
      const n = Number(tr);
      if (n >= 1 && n <= 24) return `trt${n}`;
      return null;
    }
    case '6': {
      // Justiça Eleitoral: TSE (00); TREs com alias tre-{uf} (DF = dft)
      if (tr === '00') return 'tse';
      const uf = UF_POR_TR[tr];
      if (!uf) return null;
      const sufixo = uf === 'df' ? 'dft' : uf;
      return `tre-${sufixo}`;
    }
    case '7':
      // Justiça Militar da União → STM (TR 00); circunscrições sem índice próprio
      return tr === '00' ? 'stm' : null;
    case '8': {
      // Justiça Estadual / DF
      const uf = UF_POR_TR[tr];
      if (!uf) return null;
      return uf === 'df' ? 'tjdft' : `tj${uf}`;
    }
    case '9':
      return TJM_POR_TR[tr] ?? null;
    default:
      return null;
  }
}
