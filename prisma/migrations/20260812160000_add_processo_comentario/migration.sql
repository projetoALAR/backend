-- CreateTable
CREATE TABLE "ProcessoComentario" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessoComentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessoComentario_processoId_criadoEm_idx" ON "ProcessoComentario"("processoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "ProcessoComentario" ADD CONSTRAINT "ProcessoComentario_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessoComentario" ADD CONSTRAINT "ProcessoComentario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
