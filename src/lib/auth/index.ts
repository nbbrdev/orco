import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { authOptions } from "@/lib/auth/options";
import { getAuthDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Login do Orçô com o Better Auth (ADR-0013, NBB-79). As tabelas ficam no schema `auth`, acessado só
// pela role app_auth (getAuthDb). Senhas, sessões e tokens são do Better Auth: o app nunca faz hash de
// senha por conta própria (docs/07-seguranca.md §1).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Defina ${name} (veja .env.example).`);
  }
  return value;
}

function createAuth() {
  return betterAuth({
    ...authOptions,
    // Base dos links (e-mails, retorno do Google): o endereço público de cada ambiente.
    baseURL: requireEnv("SITE_URL"),
    // Assina cookies de sessão e tokens. Um por ambiente, só no .env.
    secret: requireEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(getAuthDb(), { provider: "pg", schema }),
    // Grava os cookies de sessão quando o login acontece numa Server Action.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let auth: Auth | undefined;

/**
 * O Better Auth é criado na primeira chamada, e não ao importar este arquivo: o `next build` (e o
 * build da imagem Docker) importa as rotas, mas não tem o .env com o banco e o segredo. Mesmo padrão
 * do getAppDb().
 */
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
