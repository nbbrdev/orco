import { rejectReasonLabel, type RejectReasonCode } from "@/features/public-quote/reasons";
import { formatQuoteNumber } from "@/features/quotes/items";

// O texto dos avisos de push (RN-45, F-18, NBB-61 P6). A notificação aparece na tela bloqueada, então
// leva só o número do orçamento, o primeiro nome do cliente e o evento: nada de valores nem contatos
// (docs/07 §10.1). Função pura, testada à parte.

/** O que o service worker recebe (public/sw.js). */
export type PushMessage = {
  title: string;
  /** Para onde o toque leva: o orçamento no app. */
  url: string;
  /** Um aviso por orçamento: um novo substitui o anterior na lista de notificações. */
  tag: string;
};

/** "Maria Silva" → "Maria". Vazio ou só espaços → nulo. */
export function firstName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

export function responsePushMessage(response: {
  quoteId: string;
  number: number;
  decision: "approved" | "rejected";
  respondentName: string | null;
  clientName: string | null;
  reasonCode: RejectReasonCode | null;
}): PushMessage {
  // A mesma ordem do e-mail (RN-40): o nome informado → o cliente do orçamento → "Seu cliente".
  const who = firstName(response.respondentName) ?? firstName(response.clientName) ?? "Seu cliente";
  const number = formatQuoteNumber(response.number);
  const title =
    response.decision === "approved"
      ? `✅ ${who} aprovou o orçamento Nº ${number}`
      : `❌ ${who} recusou o orçamento Nº ${number}${
          response.reasonCode ? ` · Motivo: ${rejectReasonLabel(response.reasonCode)}` : ""
        }`;
  return { title, url: `/app/orcamentos/${response.quoteId}`, tag: `quote-${response.quoteId}` };
}
