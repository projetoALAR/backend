-- Campos de convite / reset de senha (presentes no schema Prisma, ausentes nas migrations antigas)
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);
