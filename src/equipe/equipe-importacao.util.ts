import { Role } from '../auth/roles';

export const COLUNAS_IMPORTACAO_EQUIPE = [
  'nome',
  'email',
  'cargo',
  'role',
  'senha',
  'status',
] as const;

export type ColunaImportacaoEquipe =
  (typeof COLUNAS_IMPORTACAO_EQUIPE)[number];

export type LinhaImportacaoEquipe = Partial<
  Record<ColunaImportacaoEquipe, string>
> & { linha: number };

export const CAMPOS_ALVO_EQUIPE: ReadonlyArray<{
  chave: ColunaImportacaoEquipe;
  rotulo: string;
  obrigatorio?: boolean;
}> = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true },
  { chave: 'email', rotulo: 'E-mail', obrigatorio: true },
  { chave: 'cargo', rotulo: 'Cargo' },
  { chave: 'role', rotulo: 'Papel (ADMIN / ADVOGADO / ASSISTENTE)' },
  { chave: 'senha', rotulo: 'Senha (por linha, opcional)' },
  { chave: 'status', rotulo: 'Status (active / inactive)' },
];

const ALIASES: Record<string, ColunaImportacaoEquipe> = {
  nome: 'nome',
  name: 'nome',
  'nome completo': 'nome',
  'nome do membro': 'nome',
  membro: 'nome',
  colaborador: 'nome',
  email: 'email',
  e_mail: 'email',
  'e-mail': 'email',
  'email corporativo': 'email',
  'e-mail corporativo': 'email',
  'email do colaborador': 'email',
  cargo: 'cargo',
  funcao: 'cargo',
  função: 'cargo',
  'job title': 'cargo',
  posto: 'cargo',
  role: 'role',
  papel: 'role',
  'papel de acesso': 'role',
  perfil: 'role',
  perfilacesso: 'role',
  'tipo acesso': 'role',
  senha: 'senha',
  password: 'senha',
  'senha temporaria': 'senha',
  'senha inicial': 'senha',
  status: 'status',
  situacao: 'status',
  situação: 'status',
};

function normalizarCabecalho(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function sugerirColunaEquipe(
  cabecalho: string,
): ColunaImportacaoEquipe | null {
  const chave = normalizarCabecalho(cabecalho).replace(/[_\s]+/g, ' ').trim();
  const semEspaco = chave.replace(/\s+/g, '');
  return ALIASES[chave] || ALIASES[semEspaco] || null;
}

export function normalizarRoleEquipe(raw?: string): Role | null {
  if (!raw?.trim()) return Role.ASSISTENTE;
  const t = normalizarCabecalho(raw).replace(/\s+/g, '');
  if (t === 'admin' || t === 'administrador' || t === 'adm') return Role.ADMIN;
  if (t === 'advogado' || t === 'adv' || t === 'lawyer') return Role.ADVOGADO;
  if (
    t === 'assistente' ||
    t === 'assist' ||
    t === 'estagiario' ||
    t === 'estagiaria' ||
    t === 'secretaria'
  ) {
    return Role.ASSISTENTE;
  }
  if (Object.values(Role).includes(raw.trim().toUpperCase() as Role)) {
    return raw.trim().toUpperCase() as Role;
  }
  return null;
}

export function normalizarStatusEquipe(raw?: string): string {
  if (!raw?.trim()) return 'active';
  const t = normalizarCabecalho(raw);
  if (
    t === 'inactive' ||
    t === 'inativo' ||
    t === 'inativa' ||
    t === 'desativado' ||
    t === 'off'
  ) {
    return 'inactive';
  }
  return 'active';
}

export function linhasDeTabelaEquipe(
  tabela: string[][],
): LinhaImportacaoEquipe[] {
  if (tabela.length === 0) return [];
  const cabecalhos = tabela[0].map((h) => sugerirColunaEquipe(h));
  if (!cabecalhos.includes('nome') || !cabecalhos.includes('email')) {
    throw new Error(
      'Arquivo precisa de Nome e E-mail. Use o mapeamento de colunas ou o modelo Excel.',
    );
  }
  const resultado: LinhaImportacaoEquipe[] = [];
  for (let i = 1; i < tabela.length; i++) {
    const cells = tabela[i];
    const linha: LinhaImportacaoEquipe = { linha: i + 1 };
    let temAlgo = false;
    for (let c = 0; c < cabecalhos.length; c++) {
      const col = cabecalhos[c];
      if (!col) continue;
      const valor = (cells[c] ?? '').trim();
      if (valor) {
        linha[col] = valor;
        temAlgo = true;
      }
    }
    if (temAlgo) resultado.push(linha);
  }
  return resultado;
}
