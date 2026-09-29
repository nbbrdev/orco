import { defineConfig } from "drizzle-kit";

// Configuração do drizzle-kit (ADR-0014). `npm run db:generate -- <nome>` compara o schema em
// TypeScript com as migrations já existentes e gera o SQL da diferença em db/migrations/.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./db/migrations",
  // Só usado por comandos que falam com o banco (ex.: `drizzle-kit studio`); `generate` não conecta.
  dbCredentials: { url: process.env.DATABASE_URL_OWNER ?? "" },
  schemaFilter: ["public", "auth"],
  strict: true,
  verbose: true,
});
