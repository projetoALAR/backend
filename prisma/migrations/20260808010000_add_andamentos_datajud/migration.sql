-- AlterTable
ALTER TABLE "Processo" ADD COLUMN "tribunalSigla" TEXT;

-- CreateTable
CREATE TABLE "Andamento" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigoMovimento" INTEGER,
    "origem" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Andamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Andamento_processoId_data_idx" ON "Andamento"("processoId", "data");

-- AddForeignKey
ALTER TABLE "Andamento" ADD CONSTRAINT "Andamento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
