-- CreateTable
CREATE TABLE "ProcessoTarefa" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "prazo" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessoTarefa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessoTarefa_processoId_ordem_idx" ON "ProcessoTarefa"("processoId", "ordem");

-- CreateIndex
CREATE INDEX "ProcessoTarefa_processoId_concluida_idx" ON "ProcessoTarefa"("processoId", "concluida");

-- AddForeignKey
ALTER TABLE "ProcessoTarefa" ADD CONSTRAINT "ProcessoTarefa_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessoTarefa" ADD CONSTRAINT "ProcessoTarefa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
