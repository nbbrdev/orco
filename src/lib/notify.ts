import "server-only";

import {
  type PushMessage,
  reminderPushMessage,
  responsePushMessage,
  viewedPushMessage,
} from "@/features/push/messages";
import type { RejectReasonCode } from "@/features/public-quote/reasons";
import { sendEmail } from "@/lib/email";
import type { Email } from "@/lib/email/layout";
import { quoteReminderEmail } from "@/lib/email/templates/quote-reminder";
import { quoteResponseEmail } from "@/lib/email/templates/quote-response";
import { type PushSubscriptionKeys, sendPush } from "@/lib/push";

// Avisos ao freelancer (ADR-0009, NBB-55, NBB-61, NBB-62): um lugar só decide o que mandar e por onde.
// - Resposta do cliente (RN-40) e lembrete de vencimento (RN-43): e-mail e push, cada canal com a sua
//   preferência (P6), em paralelo.
// - Primeira visualização (RN-35, N4): só push; visualização não gera e-mail (RN-40).
// Nunca lança erro: um aviso que falhou não desfaz nem atrasa nada (RN-42).

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

export type QuoteReminderEvent = {
  type: "quote_reminder";
  quoteId: string;
  number: number;
  clientName: string | null;
  /** A validade, `AAAA-MM-DD`: amanhã, no dia do lembrete. */
  validUntil: string;
};

export type FreelancerEvent = QuoteResponseEvent | QuoteViewedEvent | QuoteReminderEvent;

export async function notifyFreelancer(
  target: FreelancerTarget,
  event: FreelancerEvent,
): Promise<void> {
  await Promise.all([notifyByEmail(target, event), notifyByPush(target, event)]);
}

/** O e-mail de cada evento; a visualização não tem (RN-40). */
function emailFor(event: FreelancerEvent, siteUrl: string): Email | null {
  switch (event.type) {
    case "quote_response":
      return quoteResponseEmail({ siteUrl, ...event });
    case "quote_reminder":
      return quoteReminderEmail({ siteUrl, ...event });
    case "quote_viewed":
      return null;
  }
}

function pushFor(event: FreelancerEvent): PushMessage {
  switch (event.type) {
    case "quote_response":
      return responsePushMessage(event);
    case "quote_reminder":
      return reminderPushMessage(event);
    case "quote_viewed":
      return viewedPushMessage(event);
  }
}

async function notifyByEmail(target: FreelancerTarget, event: FreelancerEvent): Promise<void> {
  if (!target.emailNotifications || !target.accountEmail || event.type === "quote_viewed") {
    return;
  }
  try {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) throw new Error("Defina SITE_URL (veja .env.example).");
    const email = emailFor(event, siteUrl);
    if (email) await sendEmail(target.accountEmail, email);
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
    await sendPush(target.pushSubscriptions, pushFor(event));
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
