import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { authOptions } from "@/lib/auth/options";
import { getAuthDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates/confirmation";

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
  const siteUrl = requireEnv("SITE_URL");
  return betterAuth({
    ...authOptions,
    // Base dos links (e-mails, retorno do Google): o endereço público de cada ambiente.
    baseURL: siteUrl,
    // Assina cookies de sessão e tokens. Um por ambiente, só no .env.
    secret: requireEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(getAuthDb(), { provider: "pg", schema }),
    // Cadastro e reenvio só pelas nossas Server Actions, que aplicam o anti-abuso (RN-46). Pela API
    // pública estas rotas respondem 404; as chamadas internas (getAuth().api…) continuam valendo.
    disabledPaths: ["/sign-up/email", "/send-verification-email"],
    emailVerification: {
      sendOnSignUp: true,
      // F-01: depois de confirmar, a pessoa já entra logada.
      autoSignInAfterVerification: true,
      // F-01 / docs/07 §1: o link vale 1 hora.
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(user.email, confirmationEmail({ siteUrl, url }));
      },
    },
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
