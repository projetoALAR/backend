-- Índices nas tabelas quentes (dashboard, listagens, chat por processo)

CREATE INDEX IF NOT EXISTS "Processo_clienteId_idx" ON "Processo"("clienteId");
CREATE INDEX IF NOT EXISTS "Processo_concluido_idx" ON "Processo"("concluido");
CREATE INDEX IF NOT EXISTS "Processo_prazo_idx" ON "Processo"("prazo");
CREATE INDEX IF NOT EXISTS "Processo_status_idx" ON "Processo"("status");
CREATE INDEX IF NOT EXISTS "Processo_atualizadoEm_idx" ON "Processo"("atualizadoEm");

CREATE INDEX IF NOT EXISTS "Compromisso_dataHora_idx" ON "Compromisso"("dataHora");
CREATE INDEX IF NOT EXISTS "Compromisso_processoId_idx" ON "Compromisso"("processoId");

CREATE INDEX IF NOT EXISTS "Documento_processoId_idx" ON "Documento"("processoId");

CREATE INDEX IF NOT EXISTS "MembroEquipe_status_idx" ON "MembroEquipe"("status");
