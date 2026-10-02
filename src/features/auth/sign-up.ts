import "server-only";

import { isAPIError } from "better-auth/api";

import { signUpSchema } from "@/features/auth/schemas";
import { getAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// O "miolo" do cadastro e do reenvio (F-01, RN-46), sem nada do Next: as Server Actions (actions.ts)
// leem o IP e chamam estas funções. Separado assim para ser testado contra o Postgres e o Mailpit.

/** RN-46: valores iniciais, calibrados na M7. */
export const SIGN_UP_LIMIT = { perIpPerHour: 3, emailsPerDay: 60 } as const;
export const RESEND_LIMIT_PER_IP_PER_HOUR = 3;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;
/** Para onde o link de confirmação leva, já logado (F-01). */
export const AFTER_CONFIRM_PATH = "/app/orcamentos";

export type SignUpResult =
  /** Conta nova, e-mail já cadastrado ou honeypot: a mesma resposta (D3). */
  | { status: "sent"; email: string }
  | { status: "rate-limited" }
  | { status: "daily-cap" }
  | { status: "invalid"; message: string }
  | { status: "send-failed" };

/** Teto diário de e-mails de cadastro (confirmação + reenvio), somando todas as contas. */
async function withinDailyCap(): Promise<boolean> {
  return checkRateLimit("signup-email:day", SIGN_UP_LIMIT.emailsPerDay, DAY);
}

export async function registerUser(input: unknown, ip: string): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { email, password, website } = parsed.data;

  // Honeypot preenchido = robô: mesma resposta de sucesso, sem criar conta nem enviar e-mail.
  if (website) {
    return { status: "sent", email };
  }
  if (!(await checkRateLimit(`signup:ip:${ip}`, SIGN_UP_LIMIT.perIpPerHour, HOUR))) {
    return { status: "rate-limited" };
  }
  if (!(await withinDailyCap())) {
    return { status: "daily-cap" };
  }

  try {
    await getAuth().api.signUpEmail({
      // N1-B: `name` é uma coluna técnica do Better Auth; o nome de verdade mora no perfil (RN-04).
      body: {
        email,
        password,
        name: email.split("@")[0] ?? email,
        callbackURL: AFTER_CONFIRM_PATH,
      },
    });
  } catch (error) {
    // E-mail já cadastrado: a mesma resposta, para não revelar quem usa o Orçô.
    if (isAPIError(error) && error.body?.code?.startsWith("USER_ALREADY_EXISTS")) {
      return { status: "sent", email };
    }
    if (isAPIError(error)) {
      return { status: "invalid", message: "Não foi possível criar a conta. Confira os dados." };
    }
    // Falha ao enviar o e-mail de confirmação (ADR-0016: avisar a pessoa).
    return { status: "send-failed" };
  }
  return { status: "sent", email };
}

export type ResendResult =
  | { status: "sent" }
  | { status: "rate-limited" }
  | { status: "daily-cap" }
  | { status: "send-failed" };

/** Botão "Reenviar" (F-01). Mesma resposta exista ou não a conta (D5). */
export async function resendConfirmation(email: string, ip: string): Promise<ResendResult> {
  if (!(await checkRateLimit(`resend:ip:${ip}`, RESEND_LIMIT_PER_IP_PER_HOUR, HOUR))) {
    return { status: "rate-limited" };
  }
  if (!(await withinDailyCap())) {
    return { status: "daily-cap" };
  }
  try {
    await getAuth().api.sendVerificationEmail({
      body: { email, callbackURL: AFTER_CONFIRM_PATH },
    });
  } catch (error) {
    if (isAPIError(error)) {
      // Ex.: e-mail inexistente ou já confirmado: não revela nada.
      return { status: "sent" };
    }
    return { status: "send-failed" };
  }
  return { status: "sent" };
}
