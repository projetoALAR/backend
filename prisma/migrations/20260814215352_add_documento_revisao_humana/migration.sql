-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "revisadoEm" TIMESTAMP(3),
ADD COLUMN     "revisadoPorUsuarioId" TEXT;

-- CreateIndex
CREATE INDEX "Documento_revisadoPorUsuarioId_idx" ON "Documento"("revisadoPorUsuarioId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_revisadoPorUsuarioId_fkey" FOREIGN KEY ("revisadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
