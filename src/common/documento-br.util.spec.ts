import { validarCnpj, validarCpf } from './documento-br.util';

describe('documento-br.util', () => {
  it('aceita CPF com dígito verificador válido', () => {
    expect(validarCpf('390.533.447-05')).toBe(true);
    expect(validarCpf('52998224725')).toBe(true);
  });

  it('rejeita CPF inválido ou sequencial', () => {
    expect(validarCpf('123.456.789-01')).toBe(false);
    expect(validarCpf('111.111.111-11')).toBe(false);
    expect(validarCpf('123')).toBe(false);
  });

  it('aceita CNPJ com dígito verificador válido', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJ inválido', () => {
    expect(validarCnpj('12.345.678/0001-99')).toBe(false);
    expect(validarCnpj('00.000.000/0000-00')).toBe(false);
  });
});
