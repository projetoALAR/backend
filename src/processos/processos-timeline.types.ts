export const TIMELINE_TIPOS = [
  'CASO_CRIADO',
  'DOCUMENTO',
  'COMPROMISSO',
  'ANDAMENTO',
  'AUDITORIA',
  'COMENTARIO',
  'TAREFA',
] as const;

export type TimelineTipo = (typeof TIMELINE_TIPOS)[number];

export type TimelineAutor = {
  nome: string;
  email?: string | null;
};

export type TimelineEvento = {
  id: string;
  tipo: TimelineTipo;
  titulo: string;
  descricao: string | null;
  data: string;
  autor: TimelineAutor | null;
};
