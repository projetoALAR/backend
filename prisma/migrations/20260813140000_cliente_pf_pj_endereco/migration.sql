-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'PF';
ALTER TABLE "Cliente" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "nomeFantasia" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "rg" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "endereco" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "cidade" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "uf" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "cep" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "observacoes" TEXT;

ALTER TABLE "Cliente" ALTER COLUMN "cpf" DROP NOT NULL;

CREATE UNIQUE INDEX "Cliente_cnpj_key" ON "Cliente"("cnpj");
CREATE INDEX "Cliente_tipo_idx" ON "Cliente"("tipo");
