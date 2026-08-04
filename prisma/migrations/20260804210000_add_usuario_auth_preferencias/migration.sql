-- AlterTable
ALTER TABLE "Preferencia" ADD COLUMN IF NOT EXISTS "fotoUrl" TEXT;
ALTER TABLE "Preferencia" ADD COLUMN IF NOT EXISTS "notificacoesLidas" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_email_key" ON "Usuario"("email");
