import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Para criar e alterar tabelas (CLI), o Supabase EXIGE a conexão direta!
    url: env("DIRECT_URL"), 
  },
});