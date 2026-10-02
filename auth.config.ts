// Usado SÓ pelo CLI do Better Auth (`npm run auth:generate`), que gera as tabelas de login em
// src/lib/db/schema/auth.ts a partir das opções. Nenhum arquivo do app importa este: ele não entra no
// build. O `{}` no lugar do banco existe porque o betterAuth() exige um; o CLI não conecta em nada.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { authOptions } from "./src/lib/auth/options";

export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter({}, { provider: "pg", schemaName: "auth" }),
});
