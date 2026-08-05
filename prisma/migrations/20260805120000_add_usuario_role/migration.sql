-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'ADVOGADO', 'ASSISTENTE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: existing users keep full access (ADMIN); new users default to ASSISTENTE
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'ASSISTENTE';

UPDATE "Usuario" SET "role" = 'ADMIN' WHERE "role" = 'ASSISTENTE';

ALTER TABLE "Usuario" ALTER COLUMN "role" SET DEFAULT 'ASSISTENTE';
