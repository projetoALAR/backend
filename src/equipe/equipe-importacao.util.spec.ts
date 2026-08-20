import {
  linhasDeTabelaEquipe,
  normalizarRoleEquipe,
  sugerirColunaEquipe,
} from './equipe-importacao.util';
import { Role } from '../auth/roles';

describe('equipe-importacao.util', () => {
  it('sugere colunas comuns de RH', () => {
    expect(sugerirColunaEquipe('Nome Completo')).toBe('nome');
    expect(sugerirColunaEquipe('E-mail')).toBe('email');
    expect(sugerirColunaEquipe('Papel de acesso')).toBe('role');
    expect(sugerirColunaEquipe('Senha inicial')).toBe('senha');
  });

  it('normaliza papéis em português', () => {
    expect(normalizarRoleEquipe('Advogado')).toBe(Role.ADVOGADO);
    expect(normalizarRoleEquipe('Administrador')).toBe(Role.ADMIN);
    expect(normalizarRoleEquipe(undefined)).toBe(Role.ASSISTENTE);
    expect(normalizarRoleEquipe('xyz')).toBeNull();
  });

  it('parseia tabela com aliases', () => {
    const linhas = linhasDeTabelaEquipe([
      ['Colaborador', 'E-mail Corporativo', 'Função', 'Perfil'],
      ['Ana', 'ana@x.com', 'Sócia', 'Advogado'],
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      nome: 'Ana',
      email: 'ana@x.com',
      cargo: 'Sócia',
      role: 'Advogado',
    });
  });
});
