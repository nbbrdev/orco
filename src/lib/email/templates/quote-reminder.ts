import { formatQuoteNumber } from "@/features/quotes/items";
import { formatDateBR } from "@/lib/dates";
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

// "O orçamento Nº 0012 (Maria) vence amanhã e ainda não foi respondido" (RN-43, NBB-62 L5). Vai para o
// e-mail da conta, no agendamento diário, um dia antes de a validade acabar.

export type QuoteReminderEmailInput = {
  siteUrl: string;
  quoteId: string;
  number: number;
  clientName: string | null;
  /** A validade, `AAAA-MM-DD`. */
  validUntil: string;
};

/** O título do lembrete (RN-43): com o nome do cliente entre parênteses, se houver. */
export function reminderTitle(number: number, clientName: string | null): string {
  const client = clientName?.trim() ? ` (${clientName.trim()})` : "";
  return `O orçamento Nº ${formatQuoteNumber(number)}${client} vence amanhã e ainda não foi respondido`;
}

const UNSUBSCRIBE =
  "Você recebe este aviso porque as notificações por e-mail estão ligadas. Para desligar, vá em Perfil.";

export function quoteReminderEmail(input: QuoteReminderEmailInput): Email {
  const title = reminderTitle(input.number, input.clientName);
  const url = `${input.siteUrl}/app/orcamentos/${input.quoteId}`;
  const validUntil = `Válido até ${formatDateBR(input.validUntil)}.`;

  return {
    subject: title,
    html: layout({
      siteUrl: input.siteUrl,
      title,
      body: [
        paragraph(escapeHtml(validUntil)),
        button(url, "Ver orçamento"),
        fallbackLink(url),
        note(UNSUBSCRIBE),
      ].join("\n                "),
    }),
    text: textVersion(title, [validUntil, `Ver orçamento: ${url}`, UNSUBSCRIBE]),
  };
}
