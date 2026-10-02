import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { authOptions } from "@/lib/auth/options";
import { getAuthDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates/confirmation";
import { passwordChangedEmail } from "@/lib/email/templates/password-changed";
import { recoveryEmail } from "@/lib/email/templates/recovery";

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
    // Login com Google (F-02, NBB-40). Um cliente OAuth por ambiente (G2); o retorno é
    // `${SITE_URL}/api/auth/callback/google`. A conta nasce com o e-mail confirmado (RN-02) e só se
    // vincula a uma conta por senha já confirmada (padrão do Better Auth, docs/07 §1).
    socialProviders: {
      google: {
        clientId: requireEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
        // G6: a foto do perfil do Google não é usada pelo Orçô, então nem é guardada (LGPD).
        mapProfileToUser: () => ({ image: undefined }),
      },
    },
    // Erros sem destino próprio (ex.: volta do Google com `state` inválido) vão para o /entrar com
    // `?error=`, e não para a página de erro do Better Auth, em inglês (G5).
    onAPIError: { errorURL: `${siteUrl}/entrar` },
    // Cadastro, reenvio e recuperação só pelas nossas Server Actions, que aplicam o anti-abuso
    // (RN-46, NBB-41 P1). Pela API pública estas rotas respondem 404; as chamadas internas
    // (getAuth().api…) continuam valendo.
    disabledPaths: ["/sign-up/email", "/send-verification-email", "/request-password-reset"],
    emailAndPassword: {
      ...authOptions.emailAndPassword,
      // F-04: o link de redefinição vale 1 hora (padrão do Better Auth) e é de uso único.
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(user.email, recoveryEmail({ siteUrl, url }));
      },
      // P3: redefinir a senha derruba todas as sessões, inclusive a de quem invadiu a conta.
      revokeSessionsOnPasswordReset: true,
      // Aviso "Sua senha foi alterada" (docs/07 §1). Sai depois que a senha já mudou: se o envio
      // falhar, a troca continua valendo e o erro só vai para o log (P4).
      onPasswordReset: async ({ user }) => {
        try {
          await sendEmail(user.email, passwordChangedEmail({ siteUrl, email: user.email }));
        } catch (error) {
          console.error("Falha ao enviar o aviso de senha alterada.", error);
        }
      },
    },
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
