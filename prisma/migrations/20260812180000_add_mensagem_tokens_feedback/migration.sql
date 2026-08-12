-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN "tokensUsados" INTEGER;
ALTER TABLE "Mensagem" ADD COLUMN "feedback" TEXT;

-- CreateIndex
CREATE INDEX "Mensagem_conversacaoId_criadoEm_idx" ON "Mensagem"("conversacaoId", "criadoEm");
