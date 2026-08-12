-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "totpPendingSecret" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Usuario" ADD COLUMN "totpRecoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
