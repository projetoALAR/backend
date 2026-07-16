-- CreateTable
CREATE TABLE "Compromisso" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processoId" TEXT,

    CONSTRAINT "Compromisso_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
