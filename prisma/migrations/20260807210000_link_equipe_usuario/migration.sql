-- Vincula MembroEquipe a Usuario e unifica e-mails duplicados na equipe.

-- 1) Coluna de vínculo (nullable para backfill)
ALTER TABLE "MembroEquipe" ADD COLUMN IF NOT EXISTS "usuarioId" TEXT;

-- 2) Deduplica e-mails na equipe (mantém o mais antigo)
DELETE FROM "MembroEquipe" a
USING "MembroEquipe" b
WHERE lower(a.email) = lower(b.email)
  AND a."criadoEm" > b."criadoEm";

-- 3) Normaliza e-mails
UPDATE "MembroEquipe" SET email = lower(trim(email));

-- 4) Unique em e-mail (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MembroEquipe_email_key'
  ) THEN
    ALTER TABLE "MembroEquipe" ADD CONSTRAINT "MembroEquipe_email_key" UNIQUE (email);
  END IF;
END $$;

-- 5) Liga membros a usuários pelo e-mail
UPDATE "MembroEquipe" m
SET "usuarioId" = u.id
FROM "Usuario" u
WHERE lower(m.email) = lower(u.email)
  AND m."usuarioId" IS NULL;

-- 6) Cria entrada na equipe para usuários sem membro
INSERT INTO "MembroEquipe" (id, nome, email, cargo, status, "criadoEm", "usuarioId")
SELECT
  gen_random_uuid()::text,
  u.nome,
  lower(u.email),
  CASE u.role
    WHEN 'ADMIN' THEN 'Administrador'
    WHEN 'ADVOGADO' THEN 'Advogado'
    ELSE 'Assistente'
  END,
  'active',
  u."criadoEm",
  u.id
FROM "Usuario" u
WHERE NOT EXISTS (
  SELECT 1 FROM "MembroEquipe" m
  WHERE m."usuarioId" = u.id OR lower(m.email) = lower(u.email)
);

-- 7) Unique + FK em usuarioId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MembroEquipe_usuarioId_key'
  ) THEN
    ALTER TABLE "MembroEquipe" ADD CONSTRAINT "MembroEquipe_usuarioId_key" UNIQUE ("usuarioId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MembroEquipe_usuarioId_fkey'
  ) THEN
    ALTER TABLE "MembroEquipe"
      ADD CONSTRAINT "MembroEquipe_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
