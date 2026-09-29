import { existsSync } from "node:fs";

// Localmente, as URLs do banco vêm do .env.local; no CI, das variáveis do workflow.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
