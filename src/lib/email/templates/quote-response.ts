import { rejectReasonLabel, type RejectReasonCode } from "@/features/public-quote/reasons";
import { formatQuoteNumber } from "@/features/quotes/items";
import { escapeHtml } from "@/lib/email/escape";
import {
  button,
  type Email,
  fallbackLink,
  layout,
  note,
  paragraph,
  textVersion,
} from "@/lib/email/layout";

// "Maria aprovou o orçamento Nº 0012" (RN-40, NBB-55 E2). Vai para o e-mail da conta do freelancer
// quando o cliente responde pelo link. Na recusa, o motivo e o texto do cliente, se houver.

export type QuoteResponseEmailInput = {
  siteUrl: string;
  quoteId: string;
  number: number;
  decision: "approved" | "rejected";
  /** O nome informado na aprovação (RN-33). */
  respondentName: string | null;
  /** O nome do cliente do orçamento. */
  clientName: string | null;
  reasonCode: RejectReasonCode | null;
  reason: string | null;
};

/** Quem respondeu (RN-40): o nome informado → o cliente do orçamento → "Seu cliente". */
export function responderName(respondentName: string | null, clientName: string | null): string {
  return respondentName?.trim() || clientName?.trim() || "Seu cliente";
}

const UNSUBSCRIBE =
  "Você recebe este aviso porque as notificações por e-mail estão ligadas. Para desligar, vá em Perfil.";

export function quoteResponseEmail(input: QuoteResponseEmailInput): Email {
  const who = responderName(input.respondentName, input.clientName);
  const verb = input.decision === "approved" ? "aprovou" : "recusou";
  const title = `${who} ${verb} o orçamento Nº ${formatQuoteNumber(input.number)}`;
  const url = `${input.siteUrl}/app/orcamentos/${input.quoteId}`;
  const reasonLabel =
    input.decision === "rejected" && input.reasonCode ? rejectReasonLabel(input.reasonCode) : null;
  const reason = input.decision === "rejected" ? input.reason?.trim() || null : null;

  return {
    subject: title,
    html: layout({
      siteUrl: input.siteUrl,
      title,
      body: [
        paragraph(`${escapeHtml(title)}.`, reasonLabel || reason ? 16 : 24),
        reasonLabel ? paragraph(`Motivo: <strong>${escapeHtml(reasonLabel)}</strong>`, 16) : "",
        // As quebras de linha do texto do cliente viram <br> (o HTML ignora as do texto).
        reason ? paragraph(`“${escapeHtml(reason).replace(/\r?\n/g, "<br>")}”`) : "",
        button(url, "Ver orçamento"),
        fallbackLink(url),
        note(UNSUBSCRIBE),
      ]
        .filter(Boolean)
        .join("\n                "),
    }),
    text: textVersion(title, [
      `${title}.`,
      ...(reasonLabel ? [`Motivo: ${reasonLabel}`] : []),
      ...(reason ? [`“${reason}”`] : []),
      `Ver orçamento: ${url}`,
      UNSUBSCRIBE,
    ]),
  };
}
