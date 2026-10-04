import { issuerHeader, type IssuerProfile } from "@/features/profile/issuer";
import {
  describeDiscount,
  formatQuoteNumber,
  lineTotals,
  type ParsedItem,
  quoteTotals,
  type StoredDiscount,
} from "@/features/quotes/items";
import type { QuoteClient } from "@/features/quotes/quotes";
import type { QuoteStatus } from "@/features/quotes/status";
import { formatDocument } from "@/lib/document";
import { formatDateBR, todayInAppTimeZone } from "@/lib/dates";
import { formatBRL, formatQuantity } from "@/lib/money";

// O que vai no PDF do orçamento (RF-27, NBB-50), já pronto para desenhar: textos formatados em pt-BR
// e as decisões de exibição (RN-04, RN-15b). Função pura, testada à parte; o desenho fica em
// quote-document.tsx. A conta é a do money.ts (via items.ts), a mesma do editor (ADR-0006).

export type QuoteDocumentInput = {
  profile: IssuerProfile & { paymentInfo: string | null };
  /** O logo já em PNG (o react-pdf não lê WebP, N1-A), ou nulo. */
  logoPng: Uint8Array | null;
  quote: {
    number: number;
    status: QuoteStatus;
    sentAt: Date | null;
    validUntil: string;
    client: Omit<QuoteClient, "id"> | null;
    items: ParsedItem[];
    discount: StoredDiscount;
    paymentTerms: string | null;
    deliveryTime: string | null;
    notes: string | null;
  };
  /** "Agora", para a data de emissão de um rascunho (N4-A). */
  now: Date;
};

export type QuoteDocumentLine = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  /** "−10%" ou "−R$ 80,00"; vazio se a linha não tem desconto. */
  discount: string;
  total: string;
};

export type QuoteDocumentModel = {
  /** Sem nome nem e-mail de contato, `name` é nulo e o cabeçalho sai sem ele (NBB-52 D3-B). */
  issuer: { name: string | null; contacts: string[]; logoPng: Uint8Array | null };
  number: string;
  issuedAt: string;
  validUntil: string;
  client: { name: string; contacts: string[]; address: string | null } | null;
  /** A coluna de desconto só aparece se algum item tiver desconto (RN-15b). */
  showItemDiscount: boolean;
  lines: QuoteDocumentLine[];
  /** Subtotal e desconto só aparecem com desconto geral (RN-15b). */
  totals: { subtotal: string; discount: string; total: string } | { total: string };
  paymentTerms: string | null;
  deliveryTime: string | null;
  notes: string | null;
  paymentInfo: string | null;
};

export function buildQuoteDocument(input: QuoteDocumentInput): QuoteDocumentModel {
  const { quote, profile } = input;
  const totals = quoteTotals(quote.items, quote.discount);

  const lines = quote.items.map((item) => {
    const line = lineTotals(item);
    return {
      description: item.description,
      quantity: formatQuantity(item.quantityMilli),
      unit: item.unit ?? "",
      // Rascunho sem valor ainda (RN-13): a prévia mostra um traço.
      unitPrice: item.unitPriceCents === null ? "—" : formatBRL(item.unitPriceCents),
      discount: describeDiscount(item.discount, line.discountCents),
      total: formatBRL(line.totalCents),
    };
  });

  // Emitido em (N4-A): a data do envio; num rascunho, hoje (a prévia mostra como sairia agora).
  const issuedOn = todayInAppTimeZone(
    quote.status === "draft" ? input.now : (quote.sentAt ?? input.now),
  );

  return {
    issuer: { ...issuerHeader(profile), logoPng: input.logoPng },
    number: formatQuoteNumber(quote.number),
    issuedAt: formatDateBR(issuedOn),
    validUntil: formatDateBR(quote.validUntil),
    client: quote.client
      ? {
          name: quote.client.name,
          contacts: [
            quote.client.phone,
            quote.client.email,
            quote.client.document ? formatDocument(quote.client.document) : null,
          ].filter((value): value is string => !!value),
          address: quote.client.address,
        }
      : null,
    showItemDiscount: lines.some((line) => line.discount !== ""),
    lines,
    totals:
      totals.discountCents > 0
        ? {
            subtotal: formatBRL(totals.subtotalCents),
            discount: `−${formatBRL(totals.discountCents)}`,
            total: formatBRL(totals.totalCents),
          }
        : { total: formatBRL(totals.totalCents) },
    paymentTerms: quote.paymentTerms,
    deliveryTime: quote.deliveryTime,
    notes: quote.notes,
    paymentInfo: profile.paymentInfo,
  };
}
