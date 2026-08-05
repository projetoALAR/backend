import { Role } from '@prisma/client';

export { Role };

export const ALL_ROLES = [Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE] as const;

/** Escrita em clientes e processos (não assistente). */
export const ROLES_GESTAO = [Role.ADMIN, Role.ADVOGADO] as const;

/** Gestão de equipe e criação de usuários. */
export const ROLES_ADMIN = [Role.ADMIN] as const;
