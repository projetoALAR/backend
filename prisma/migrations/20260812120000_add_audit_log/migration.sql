-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "usuarioEmail" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entidade_criadoEm_idx" ON "AuditLog"("entidade", "criadoEm");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_criadoEm_idx" ON "AuditLog"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "AuditLog_entidadeId_idx" ON "AuditLog"("entidadeId");

-- CreateIndex
CREATE INDEX "AuditLog_criadoEm_idx" ON "AuditLog"("criadoEm");
