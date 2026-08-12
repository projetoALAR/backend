import { assertSenhaForte, senhaAtendePolitica } from './password-policy';

describe('password-policy', () => {
  it('aceita senha com maiúscula, minúscula, número e 10+ chars', () => {
    expect(senhaAtendePolitica('AlarSenha1x')).toBe(true);
  });

  it('rejeita senha curta ou sem complexidade', () => {
    expect(senhaAtendePolitica('curta')).toBe(false);
    expect(senhaAtendePolitica('senhasenha')).toBe(false);
    expect(senhaAtendePolitica('Senhasenha')).toBe(false);
    expect(senhaAtendePolitica('senha12345')).toBe(false);
  });

  it('assertSenhaForte lança em senha fraca', () => {
    expect(() => assertSenhaForte('123456')).toThrow();
  });
});
