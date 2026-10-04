import "server-only";

import { responsePushMessage, viewedPushMessage } from "@/features/push/messages";
import type { RejectReasonCode } from "@/features/public-quote/reasons";
import { sendEmail } from "@/lib/email";
import { quoteResponseEmail } from "@/lib/email/templates/quote-response";
import { type PushSubscriptionKeys, sendPush } from "@/lib/push";

// Avisos ao freelancer (ADR-0009, NBB-55, NBB-61): um lugar só decide o que mandar e por onde.
// - Resposta do cliente (RN-40): e-mail e push, cada canal com a sua preferência (P6), em paralelo.
// - Primeira visualização (RN-35, N4): só push; visualização não gera e-mail (RN-40).
// - O lembrete de vencimento entra na NBB-62.
// Nunca lança erro: um aviso que falhou não desfaz nem atrasa a resposta do cliente (RN-42).

/**
 * Para quem vai o aviso: o e-mail da conta e a preferência do perfil (RN-41), e as assinaturas de
 * push dos aparelhos (RN-45). Na visualização, que não manda e-mail, o e-mail vem nulo.
 */
export type FreelancerTarget = {
  accountEmail: string | null;
  emailNotifications: boolean;
  pushSubscriptions: PushSubscriptionKeys[];
};

export type QuoteResponseEvent = {
  type: "quote_response";
  quoteId: string;
  number: number;
  decision: "approved" | "rejected";
  respondentName: string | null;
  clientName: string | null;
  reasonCode: RejectReasonCode | null;
  reason: string | null;
};

export type QuoteViewedEvent = {
  type: "quote_viewed";
  quoteId: string;
  number: number;
  clientName: string | null;
};

export type FreelancerEvent = QuoteResponseEvent | QuoteViewedEvent;

export async function notifyFreelancer(
  target: FreelancerTarget,
  event: FreelancerEvent,
): Promise<void> {
  await Promise.all([
    event.type === "quote_response" ? notifyByEmail(target, event) : null,
    notifyByPush(target, event),
  ]);
}

async function notifyByEmail(target: FreelancerTarget, event: QuoteResponseEvent): Promise<void> {
  if (!target.emailNotifications || !target.accountEmail) {
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

async function notifyByPush(target: FreelancerTarget, event: FreelancerEvent): Promise<void> {
  try {
    await sendPush(
      target.pushSubscriptions,
      event.type === "quote_response" ? responsePushMessage(event) : viewedPushMessage(event),
    );
  } catch (error) {
    console.error("Falha ao enviar o push ao freelancer.", {
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
