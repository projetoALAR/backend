import {
  formatarNumeroCnj,
  nomeTribunal,
  normalizarNumeroCnj,
  resolverTribunalSigla,
  validarDigitoCnj,
} from './datajud-tribunal.util';

describe('datajud-tribunal.util', () => {
  describe('normalizarNumeroCnj', () => {
    it('remove pontuação e aceita 20 dígitos', () => {
      expect(normalizarNumeroCnj('1000123-45.2024.8.26.0100')).toBe(
        '10001234520248260100',
      );
    });

    it('rejeita número com tamanho inválido', () => {
      expect(normalizarNumeroCnj('123')).toBeNull();
    });
  });

  describe('validarDigitoCnj', () => {
    it('aceita dígito verificador calculado pela regra do CNJ', () => {
      const sequencial = '0000001';
      const resto = '20248260100';
      const dv = String(98n - (BigInt(sequencial + resto) % 97n)).padStart(
        2,
        '0',
      );
      expect(validarDigitoCnj(sequencial + dv + resto)).toBe(true);
      if (dv !== '99') {
        expect(validarDigitoCnj(sequencial + '99' + resto)).toBe(false);
      }
    });

    it('rejeita tamanho inválido', () => {
      expect(validarDigitoCnj('123')).toBe(false);
    });
  });

  describe('resolverTribunalSigla', () => {
    it('resolve TJSP (Justiça Estadual, TR=26)', () => {
      // NNNNNNN DD AAAA J TR OOOO → ...8.26....
      expect(resolverTribunalSigla('1000123-45.2024.8.26.0100')).toBe('tjsp');
    });

    it('resolve TRF1 (Justiça Federal, TR=01)', () => {
      expect(resolverTribunalSigla('0000832-35.2018.4.01.3202')).toBe('trf1');
    });

    it('resolve TRT2 (Justiça do Trabalho, TR=02)', () => {
      expect(resolverTribunalSigla('1000001-00.2023.5.02.0001')).toBe('trt2');
    });

    it('resolve STJ (tribunal superior)', () => {
      expect(resolverTribunalSigla('0000100-15.2008.3.00.0000')).toBe('stj');
    });

    it('resolve TJDFT (UF DF)', () => {
      expect(resolverTribunalSigla('0000100-15.2008.8.07.0001')).toBe('tjdft');
    });

    it('retorna null para STF (sem índice público)', () => {
      expect(resolverTribunalSigla('0000100-15.2008.1.00.0000')).toBeNull();
    });

    it('retorna null para número inválido', () => {
      expect(resolverTribunalSigla('abc')).toBeNull();
    });
  });

  describe('nomeTribunal', () => {
    it('formata a sigla do índice', () => {
      expect(nomeTribunal('tjsp')).toBe('TJSP');
      expect(nomeTribunal('tre-sp')).toBe('TRE-SP');
    });
  });
});
