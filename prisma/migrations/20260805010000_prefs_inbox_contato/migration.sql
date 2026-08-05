-- Preferencia: de singleton para por usuário
ALTER TABLE "Preferencia" ADD COLUMN IF NOT EXISTS "usuarioId" TEXT;

DO $$
DECLARE
  first_user TEXT;
BEGIN
  SELECT id INTO first_user FROM "Usuario" ORDER BY "criadoEm" ASC LIMIT 1;
  IF first_user IS NOT NULL THEN
    UPDATE "Preferencia" SET "usuarioId" = first_user WHERE id = 'default' AND ("usuarioId" IS NULL OR "usuarioId" = '');
  END IF;
END $$;

DELETE FROM "Preferencia" WHERE "usuarioId" IS NULL;

ALTER TABLE "Preferencia" ALTER COLUMN "usuarioId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Preferencia_usuarioId_key" ON "Preferencia"("usuarioId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Preferencia_usuarioId_fkey'
  ) THEN
    ALTER TABLE "Preferencia"
      ADD CONSTRAINT "Preferencia_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Inbox
CREATE TABLE IF NOT EXISTS "InboxItem" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'sistema',
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InboxItem_usuarioId_lida_idx" ON "InboxItem"("usuarioId", "lida");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InboxItem_usuarioId_fkey'
  ) THEN
    ALTER TABLE "InboxItem"
      ADD CONSTRAINT "InboxItem_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ContatoLog
CREATE TABLE IF NOT EXISTS "ContatoLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "alvoNome" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContatoLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContatoLog_usuarioId_criadoEm_idx" ON "ContatoLog"("usuarioId", "criadoEm");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContatoLog_usuarioId_fkey'
  ) THEN
    ALTER TABLE "ContatoLog"
      ADD CONSTRAINT "ContatoLog_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
