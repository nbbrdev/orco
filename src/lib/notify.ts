import "server-only";

import type { RejectReasonCode } from "@/features/public-quote/reasons";
import { sendEmail } from "@/lib/email";
import { quoteResponseEmail } from "@/lib/email/templates/quote-response";

// Avisos ao freelancer (ADR-0009, NBB-55): um lugar só decide o que mandar e por onde. Hoje, o e-mail
// da resposta do cliente (RN-40); o push entra na NBB-61 e o lembrete de vencimento na NBB-62.
// Nunca lança erro: um aviso que falhou não desfaz nem atrasa a resposta do cliente (RN-42).

/** Para quem vai o aviso: o e-mail da conta e a preferência do perfil (RN-41). */
export type FreelancerTarget = {
  accountEmail: string;
  emailNotifications: boolean;
};

export type FreelancerEvent = {
  type: "quote_response";
  quoteId: string;
  number: number;
  decision: "approved" | "rejected";
  respondentName: string | null;
  clientName: string | null;
  reasonCode: RejectReasonCode | null;
  reason: string | null;
};

export async function notifyFreelancer(
  target: FreelancerTarget,
  event: FreelancerEvent,
): Promise<void> {
  if (!target.emailNotifications) {
    return;
  }
  try {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) throw new Error("Defina SITE_URL (veja .env.example).");
    await sendEmail(target.accountEmail, quoteResponseEmail({ siteUrl, ...event }));
  } catch (error) {
    // Sem a mensagem do erro: ela pode trazer o e-mail do destinatário (E5).
    console.error("Falha ao enviar o aviso ao freelancer.", {
      quoteId: event.quoteId,
      code: errorCode(error),
    });
  }
}

/** O código do erro (ex.: ECONNECTION, do nodemailer), ou o tipo dele. */
function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return error instanceof Error ? error.name : "unknown";
}
