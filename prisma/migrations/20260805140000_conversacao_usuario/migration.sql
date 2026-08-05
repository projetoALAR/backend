-- AlterTable
ALTER TABLE "Conversacao" ADD COLUMN IF NOT EXISTS "usuarioId" TEXT;

-- Backfill: atribui conversas órfãs ao usuário mais antigo
UPDATE "Conversacao" c
SET "usuarioId" = (SELECT u."id" FROM "Usuario" u ORDER BY u."criadoEm" ASC LIMIT 1)
WHERE c."usuarioId" IS NULL
  AND EXISTS (SELECT 1 FROM "Usuario" LIMIT 1);

-- Remove conversas órfãs se não houver nenhum usuário
DELETE FROM "Conversacao" WHERE "usuarioId" IS NULL;

-- Enforce NOT NULL + FK
ALTER TABLE "Conversacao" ALTER COLUMN "usuarioId" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Conversacao"
    ADD CONSTRAINT "Conversacao_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Conversacao_usuarioId_processoId_idx"
  ON "Conversacao"("usuarioId", "processoId");

CREATE INDEX IF NOT EXISTS "Conversacao_usuarioId_atualizadoEm_idx"
  ON "Conversacao"("usuarioId", "atualizadoEm");
