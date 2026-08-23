export type PlanoId = 'essencial' | 'profissional' | 'escritorio';
export type CicloCobranca = 'MONTHLY' | 'YEARLY';

export type PlanoComercial = {
  id: PlanoId
  nome: string;
  precoMensal: number;
  precoAnual: number;
  checkoutDisponivel: boolean;
};

export const PLANOS_COMERCIAIS: Record<PlanoId, PlanoComercial> = {
  essencial: {
    id: 'essencial',
    nome: 'Essencial',
    precoMensal: 197,
    precoAnual: 1970,
    checkoutDisponivel: true,
  },
  profissional: {
    id: 'profissional',
    nome: 'Profissional',
    precoMensal: 397,
    precoAnual: 3970,
    checkoutDisponivel: true,
  },
  escritorio: {
    id: 'escritorio',
    nome: 'Escritório',
    precoMensal: 897,
    precoAnual: 8970,
    checkoutDisponivel: false,
  },
};

export function valorDoPlano(planoId: PlanoId, ciclo: CicloCobranca): number {
  const plano = PLANOS_COMERCIAIS[planoId];
  return ciclo === 'YEARLY' ? plano.precoAnual : plano.precoMensal;
}

export function isPlanoId(value: string): value is PlanoId {
  return value === 'essencial' || value === 'profissional' || value === 'escritorio';
}
