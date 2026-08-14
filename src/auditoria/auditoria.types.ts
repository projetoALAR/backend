export const AUDIT_ACOES = [
  'CRIAR',
  'EDITAR',
  'EXCLUIR',
  'EXTRACAO_IA',
] as const;
export type AuditAcao = (typeof AUDIT_ACOES)[number];

export const AUDIT_ENTIDADES = [
  'CLIENTE',
  'PROCESSO',
  'DOCUMENTO',
  'USUARIO',
  'TAREFA',
  'ANDAMENTO',
] as const;
export type AuditEntidade = (typeof AUDIT_ENTIDADES)[number];

export type AuditActor = {
  id?: string;
  nome?: string;
  email?: string;
} | null;

export type RegistrarAuditInput = {
  acao: AuditAcao;
  entidade: AuditEntidade;
  /** Opcional quando a entidade ainda não existe (ex.: extração de IA antes de criar o registro). */
  entidadeId?: string;
  resumo: string;
  ator?: AuditActor;
};
