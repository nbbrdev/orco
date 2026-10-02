"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requestRecovery, resetPassword } from "@/features/auth/recovery";
import { recoverySchema, resendSchema, signInSchema } from "@/features/auth/schemas";
import { AFTER_CONFIRM_PATH, registerUser, resendConfirmation } from "@/features/auth/sign-up";
import { getAuth } from "@/lib/auth";
import { getClientIp } from "@/lib/request";

// Server Actions do cadastro, do login, da recuperação de senha e do logout (F-01, F-03, F-04). Rodam
// no servidor; os formulários as chamam como funções. Toda entrada é validada de novo aqui (Zod),
// mesmo já validada no navegador.

const MESSAGES = {
  rateLimited: "Muitas tentativas. Tente de novo em alguns minutos.",
  dailyCap: "Estamos com muitos cadastros hoje. Tente amanhã ou use Continuar com Google.",
  sendFailed: "Não conseguimos enviar o e-mail agora. Tente de novo em instantes.",
  wrongCredentials: "E-mail ou senha incorretos.",
  unverified: "Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.",
} as const;

export type SignUpState = { status: "sent"; email: string } | { status: "error"; message: string };

export async function signUpAction(input: unknown): Promise<SignUpState> {
  const result = await registerUser(input, await getClientIp());
  switch (result.status) {
    case "sent":
      return { status: "sent", email: result.email };
    case "rate-limited":
      return { status: "error", message: MESSAGES.rateLimited };
    case "daily-cap":
      return { status: "error", message: MESSAGES.dailyCap };
    case "send-failed":
      return { status: "error", message: MESSAGES.sendFailed };
    case "invalid":
      return { status: "error", message: result.message };
  }
}

export type ResendState = { status: "sent" } | { status: "error"; message: string };

export async function resendAction(input: unknown): Promise<ResendState> {
  const parsed = resendSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Informe um e-mail válido." };
  }
  const result = await resendConfirmation(parsed.data.email, await getClientIp());
  switch (result.status) {
    case "sent":
      return { status: "sent" };
    case "rate-limited":
      return { status: "error", message: MESSAGES.rateLimited };
    case "daily-cap":
      return { status: "error", message: MESSAGES.dailyCap };
    case "send-failed":
      return { status: "error", message: MESSAGES.sendFailed };
  }
}

export type SignInState =
  | { status: "error"; message: string }
  /** E-mail ainda não confirmado: a tela oferece o "Reenviar" (F-03). */
  | { status: "unverified"; email: string; message: string };

/** Em caso de sucesso, não retorna: redireciona já logado para a lista de orçamentos. */
export async function signInAction(input: unknown): Promise<SignInState> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.wrongCredentials };
  }
  try {
    // Os headers levam o IP (X-Forwarded-For) para o limite de tentativas do Better Auth (C4).
    await getAuth().api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "EMAIL_NOT_VERIFIED") {
      return { status: "unverified", email: parsed.data.email, message: MESSAGES.unverified };
    }
    if (isAPIError(error) && error.statusCode === 429) {
      return { status: "error", message: MESSAGES.rateLimited };
    }
    // Credenciais erradas (sem dizer qual) ou qualquer outro erro.
    return { status: "error", message: MESSAGES.wrongCredentials };
  }
  redirect(AFTER_CONFIRM_PATH);
}

export type RecoveryState = { status: "sent" } | { status: "error"; message: string };

/** "Esqueci minha senha" (F-04): a resposta não revela se a conta existe. */
export async function requestRecoveryAction(input: unknown): Promise<RecoveryState> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Informe um e-mail válido." };
  }
  const result = await requestRecovery(parsed.data.email, await getClientIp());
  switch (result.status) {
    case "sent":
      return { status: "sent" };
    case "rate-limited":
      return { status: "error", message: MESSAGES.rateLimited };
    case "send-failed":
      return { status: "error", message: MESSAGES.sendFailed };
  }
}

export type ResetPasswordState = { status: "error"; message: string };

/**
 * Nova senha (F-04). Em caso de sucesso, não retorna: manda para o /entrar com o aviso (P2), já que o
 * Better Auth não faz login nesse passo. Link vencido ou já usado: volta para pedir outro (P9).
 */
export async function resetPasswordAction(input: unknown): Promise<ResetPasswordState> {
  const result = await resetPassword(input);
  switch (result.status) {
    case "changed":
      redirect("/entrar?aviso=senha-alterada");
    case "invalid-token":
      redirect("/recuperar-senha?aviso=link-invalido");
    case "invalid":
      return { status: "error", message: result.message };
  }
}

/** Sair (RF-06): apaga a sessão no banco e o cookie (docs/07 §2) e volta para o /entrar (P7). */
export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/entrar");
}
