export const AUDIT_ACOES = ['CRIAR', 'EDITAR', 'EXCLUIR'] as const;
export type AuditAcao = (typeof AUDIT_ACOES)[number];

export const AUDIT_ENTIDADES = [
  'CLIENTE',
  'PROCESSO',
  'DOCUMENTO',
  'USUARIO',
  'TAREFA',
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
  entidadeId: string;
  resumo: string;
  ator?: AuditActor;
};
