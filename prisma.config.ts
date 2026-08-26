import "dotenv/config";
import { defineConfig } from "@prisma/config";

/**
 * Migrate/CLI preferem DIRECT_URL (Supabase session :5432).
 * Se só houver DATABASE_URL (ex.: Railway sem DIRECT_URL), usa como fallback
 * para o boot não quebrar — ideal ainda é definir as duas.
 */
function resolveDatasourceUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;

  const database = process.env.DATABASE_URL?.trim();
  if (database) {
    console.warn(
      "[prisma.config] DIRECT_URL ausente — usando DATABASE_URL. No Supabase, prefira DIRECT_URL (:5432) para migrate.",
    );
    return database;
  }

  throw new Error(
    "Prisma: defina DIRECT_URL (recomendado) ou DATABASE_URL nas variáveis de ambiente.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: resolveDatasourceUrl(),
  },
});
