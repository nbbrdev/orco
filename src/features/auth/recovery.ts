import "server-only";

import { isAPIError } from "better-auth/api";

import { resetPasswordSchema } from "@/features/auth/schemas";
import { getAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// O "miolo" da recuperação de senha (F-04), sem nada do Next, como o sign-up.ts: as Server Actions
// leem o IP e chamam estas funções, e os testes de integração as chamam direto.

/** NBB-41 P1: valor inicial, calibrado na M7. Não conta no teto diário do cadastro (RN-46). */
export const RECOVERY_LIMIT_PER_IP_PER_HOUR = 3;

/** Para onde o link do e-mail leva: `?token=…` se válido, `?error=INVALID_TOKEN` se não. */
export const RESET_PASSWORD_PATH = "/redefinir-senha";

const HOUR = 60 * 60;

export type RecoveryResult =
  { status: "sent" } | { status: "rate-limited" } | { status: "send-failed" };

/** "Esqueci minha senha". Mesma resposta exista ou não a conta (F-04, docs/07 §1). */
export async function requestRecovery(email: string, ip: string): Promise<RecoveryResult> {
  if (!(await checkRateLimit(`recovery:ip:${ip}`, RECOVERY_LIMIT_PER_IP_PER_HOUR, HOUR))) {
    return { status: "rate-limited" };
  }
  try {
    await getAuth().api.requestPasswordReset({ body: { email, redirectTo: RESET_PASSWORD_PATH } });
  } catch (error) {
    if (isAPIError(error)) {
      // Nada a revelar: a resposta é a mesma.
      return { status: "sent" };
    }
    // Falha ao enviar o e-mail (ADR-0016: avisar a pessoa).
    return { status: "send-failed" };
  }
  return { status: "sent" };
}

export type ResetPasswordResult =
  | { status: "changed" }
  /** Link vencido, já usado ou adulterado (P9). */
  | { status: "invalid-token" }
  | { status: "invalid"; message: string };

/** Grava a nova senha. O Better Auth consome o token (uso único) e derruba as sessões (P3). */
export async function resetPassword(input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const tokenIssue = parsed.error.issues.some((issue) => issue.path[0] === "token");
    return tokenIssue
      ? { status: "invalid-token" }
      : { status: "invalid", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    await getAuth().api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
    });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_TOKEN") {
      return { status: "invalid-token" };
    }
    return { status: "invalid", message: "Não foi possível salvar a senha. Tente de novo." };
  }
  return { status: "changed" };
}
