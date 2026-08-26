/** Helpers para e2e com CPF/CNJ válidos (dígito verificador). */

export function cnjValidoDeSeed(seed: string | number): string {
  const n = Number(String(seed).replace(/\D/g, '').slice(-9) || '1');
  const seq = String((n % 9_000_000) + 1).padStart(7, '0');
  const resto = '20248260100';
  const dv = String(98n - (BigInt(seq + resto) % 97n)).padStart(2, '0');
  return `${seq}-${dv}.2024.8.26.0100`;
}

export function cpfValidoDeSeed(seed: string | number): string {
  let base = String(seed).replace(/\D/g, '').slice(-9).padStart(9, '0');
  if (/^(\d)\1{8}$/.test(base)) {
    base = `1${base.slice(1)}`;
  }
  const calc = (digits: string, fator: number) => {
    let soma = 0;
    for (let i = 0; i < digits.length; i += 1) {
      soma += Number(digits[i]) * (fator - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calc(base, 10);
  const d2 = calc(base + String(d1), 11);
  return `${base}${d1}${d2}`;
}
