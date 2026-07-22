-- AlterTable
ALTER TABLE "Processo" ADD COLUMN     "concluido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prazo" TIMESTAMP(3),
ADD COLUMN     "prioridade" TEXT,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "titulo" TEXT;

-- CreateTable
CREATE TABLE "MembroEquipe" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembroEquipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preferencia" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nome" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "notificacoes" JSONB NOT NULL DEFAULT '{"email":true,"push":true,"reminders":true,"teamUpdates":true}',
    "tema" TEXT NOT NULL DEFAULT 'light',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversacao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "processoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "isUser" BOOLEAN NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversacaoId" TEXT NOT NULL,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Conversacao" ADD CONSTRAINT "Conversacao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversacaoId_fkey" FOREIGN KEY ("conversacaoId") REFERENCES "Conversacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
