import "server-only";

import { getProfile } from "@/features/profile/profile";
import { getQuoteForEditor, sendQuote } from "@/features/quotes/quotes";
import { checkRateLimit } from "@/lib/rate-limit";
import { getObject } from "@/lib/storage";
import { quotePdfFileName } from "@/pdf/file-name";
import { logoToPng } from "@/pdf/logo";
import type { QuoteDocumentInput } from "@/pdf/model";
import { renderQuotePdf } from "@/pdf/render";

/** PDFs por minuto por conta, somando prévia e download (RN-39, NBB-51 P7). */
export const PDF_LIMIT_PER_MINUTE = 20;
export const PDF_LIMIT_MESSAGE = "Muitos PDFs em pouco tempo. Tente de novo em um minuto.";

// Os dados do PDF do dono (NBB-51): o orçamento, o perfil e o logo, sempre pelo withUserDb (dentro do
// getQuoteForEditor e do getProfile), então a RLS garante que cada pessoa só gera o PDF dos próprios
// orçamentos. O PDF público, por token, fica para a M6 (P1-A).

export type QuotePdf = { input: QuoteDocumentInput; fileName: string };

/** Tudo o que o PDF precisa, ou `null` se o orçamento não existe ou é de outra conta. */
export async function loadQuotePdf(
  user: { id: string; email: string },
  quoteId: string,
): Promise<QuotePdf | null> {
  const quote = await getQuoteForEditor(user.id, quoteId);
  if (!quote) {
    return null;
  }
  const profile = await getProfile(user.id);
  // Logo que sumiu do RustFS ou não é imagem: o PDF sai sem ele, em vez de falhar.
  const logo = profile.logoPath ? await getObject(profile.logoPath) : null;

  return {
    fileName: quotePdfFileName(quote.number, quote.client?.name ?? null),
    input: {
      profile,
      accountEmail: user.email,
      logoPng: logo ? await logoToPng(logo) : null,
      quote: {
        number: quote.number,
        status: quote.status,
        sentAt: quote.sentAt,
        validUntil: quote.options.validUntil,
        client: quote.client,
        items: quote.items,
        discount: quote.options.discount,
        paymentTerms: quote.options.paymentTerms,
        deliveryTime: quote.options.deliveryTime,
        notes: quote.options.notes,
      },
      now: new Date(),
    },
  };
}

export type OwnerPdfResult =
  | { status: "ok"; bytes: Uint8Array; fileName: string }
  | { status: "limit" }
  | { status: "not_found" }
  | { status: "incomplete" };

/**
 * O PDF do orçamento para o dono: confere o limite (RN-39) e gera.
 * - Prévia (`send: false`, RN-22a): não muda o status.
 * - Download (`send: true`, RN-22): antes, envia o rascunho; se faltar algo da RN-13, não gera.
 */
export async function renderOwnerPdf(
  user: { id: string; email: string },
  quoteId: string,
  { send }: { send: boolean } = { send: false },
): Promise<OwnerPdfResult> {
  if (!(await checkRateLimit(`pdf:user:${user.id}`, PDF_LIMIT_PER_MINUTE, 60))) {
    return { status: "limit" };
  }
  if (send) {
    const sent = await sendQuote(user.id, quoteId);
    if (sent === "not_found" || sent === "incomplete") {
      return { status: sent };
    }
  }
  // Depois do envio, o PDF já sai com a data de emissão (N4-A).
  const pdf = await loadQuotePdf(user, quoteId);
  if (!pdf) {
    return { status: "not_found" };
  }
  return { status: "ok", bytes: await renderQuotePdf(pdf.input), fileName: pdf.fileName };
}
