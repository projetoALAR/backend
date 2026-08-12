-- AlterTable
ALTER TABLE "Processo" ADD COLUMN "responsavelId" TEXT;
ALTER TABLE "Processo" ADD COLUMN "coResponsavelId" TEXT;

-- CreateIndex
CREATE INDEX "Processo_responsavelId_idx" ON "Processo"("responsavelId");
CREATE INDEX "Processo_coResponsavelId_idx" ON "Processo"("coResponsavelId");

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_coResponsavelId_fkey" FOREIGN KEY ("coResponsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
