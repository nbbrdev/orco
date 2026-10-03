import { MAX_ITEM_PRICE_CENTS, QUOTE_LIMITS } from "@/lib/db/schema/quote-limits";
import {
  type Cents,
  calculateLine,
  calculateQuote,
  formatBRL,
  formatBRLInput,
  formatQuantity,
  type LineTotals,
  parseBRL,
  parseQuantity,
  type QuantityMilli,
} from "@/lib/money";

// Itens do editor de orçamento (F-05, NBB-86). Funções puras, usadas no navegador (total na hora e
// campos destacados, P3-A) e no servidor (que valida de novo e recalcula, P2-A). A conta em si é a
// do src/lib/money.ts.

/** Um item como está nos campos da tela: tudo texto, do jeito que a pessoa digitou. */
export type ItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

export type ItemField = "description" | "quantity" | "unitPrice";
export type ItemErrors = Partial<Record<ItemField, string>>;

/** Um item já convertido: quantidade em milésimos e preço em centavos (nulo = sem preço, RN-13). */
export type ParsedItem = {
  id: string;
  description: string;
  quantityMilli: QuantityMilli;
  unitPriceCents: Cents | null;
};

export type ParseItemResult = { ok: true; item: ParsedItem } | { ok: false; errors: ItemErrors };

/**
 * Confere e converte um item. No rascunho, descrição e preço podem ficar vazios (RN-13); a
 * quantidade precisa existir, porque o banco não guarda item sem ela.
 */
export function parseItem(draft: ItemDraft): ParseItemResult {
  const errors: ItemErrors = {};

  const description = draft.description.trim();
  if (description.length > QUOTE_LIMITS.itemDescription) {
    errors.description = `Use até ${QUOTE_LIMITS.itemDescription} caracteres.`;
  }

  const quantityText = draft.quantity.trim();
  const quantityMilli = quantityText ? parseQuantity(quantityText) : null;
  if (!quantityText) {
    errors.quantity = "Informe a quantidade.";
  } else if (quantityMilli === null) {
    errors.quantity = "Informe uma quantidade válida, ex.: 1,5";
  }

  const priceText = draft.unitPrice.trim();
  const unitPriceCents = priceText ? parseBRL(priceText) : null;
  if (priceText && unitPriceCents === null) {
    errors.unitPrice = "Informe um valor válido, ex.: 1.234,56";
  } else if (unitPriceCents !== null && unitPriceCents > MAX_ITEM_PRICE_CENTS) {
    errors.unitPrice = `O valor pode ser de até ${formatBRL(MAX_ITEM_PRICE_CENTS)}.`;
  }

  if (Object.keys(errors).length > 0 || quantityMilli === null) {
    return { ok: false, errors };
  }
  return { ok: true, item: { id: draft.id, description, quantityMilli, unitPriceCents } };
}

/** Totais de uma linha (RN-15). Sem preço, a linha vale zero até ser preenchida. */
export function lineTotals(item: ParsedItem): LineTotals {
  return calculateLine({
    quantityMilli: item.quantityMilli,
    unitPriceCents: item.unitPriceCents ?? 0,
  });
}

/** Total do orçamento (RN-16, RN-18). Os descontos chegam na NBB-88. */
export function itemsTotal(items: readonly ParsedItem[]): Cents {
  return calculateQuote(
    items.map((item) => ({
      quantityMilli: item.quantityMilli,
      unitPriceCents: item.unitPriceCents ?? 0,
    })),
  ).totalCents;
}

/** Um item novo, vazio, com quantidade 1. O id nasce no navegador (P2-A). */
export function newItemDraft(): ItemDraft {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "" };
}

/** Um item salvo, de volta para os campos da tela. */
export function toItemDraft(item: ParsedItem): ItemDraft {
  return {
    id: item.id,
    description: item.description,
    quantity: formatQuantity(item.quantityMilli),
    unitPrice: item.unitPriceCents === null ? "" : formatBRLInput(item.unitPriceCents),
  };
}

/** Número do orçamento com 4 dígitos (RN-12): 1 → "0001". */
export function formatQuoteNumber(quoteNumber: number): string {
  return String(quoteNumber).padStart(4, "0");
}
