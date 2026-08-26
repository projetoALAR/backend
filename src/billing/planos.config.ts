export type PlanoId = 'essencial' | 'profissional' | 'escritorio';
export type CicloCobranca = 'MONTHLY' | 'YEARLY';

export type LimitesPlano = {
  /** Máximo de usuários (contas) no workspace. */
  maxUsuarios: number;
  /** Tokens de IA por usuário/dia. */
  tokensDia: number;
  /** Armazenamento de documentos em GB. */
  maxGbDocumentos: number;
};

export type PlanoComercial = {
  id: PlanoId;
  nome: string;
  precoMensal: number;
  precoAnual: number;
  checkoutDisponivel: boolean;
  limites: LimitesPlano;
};

export const PLANOS_COMERCIAIS: Record<PlanoId, PlanoComercial> = {
  essencial: {
    id: 'essencial',
    nome: 'Essencial',
    precoMensal: 197,
    precoAnual: 1970,
    checkoutDisponivel: true,
    limites: { maxUsuarios: 3, tokensDia: 50_000, maxGbDocumentos: 10 },
  },
  profissional: {
    id: 'profissional',
    nome: 'Profissional',
    precoMensal: 397,
    precoAnual: 3970,
    checkoutDisponivel: true,
    limites: { maxUsuarios: 12, tokensDia: 200_000, maxGbDocumentos: 50 },
  },
  escritorio: {
    id: 'escritorio',
    nome: 'Escritório',
    precoMensal: 897,
    precoAnual: 8970,
    checkoutDisponivel: false,
    limites: { maxUsuarios: 100, tokensDia: 1_000_000, maxGbDocumentos: 200 },
  },
};

export function valorDoPlano(planoId: PlanoId, ciclo: CicloCobranca): number {
  const plano = PLANOS_COMERCIAIS[planoId];
  return ciclo === 'YEARLY' ? plano.precoAnual : plano.precoMensal;
}

export function limitesDoPlano(planoId: string | null | undefined): LimitesPlano | null {
  if (!planoId || !isPlanoId(planoId)) return null;
  return PLANOS_COMERCIAIS[planoId].limites;
}

export function isPlanoId(value: string): value is PlanoId {
  return value === 'essencial' || value === 'profissional' || value === 'escritorio';
}
