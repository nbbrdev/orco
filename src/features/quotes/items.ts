import { MAX_ITEM_PRICE_CENTS, QUOTE_LIMITS } from "@/lib/db/schema/quote-limits";
import { formatDateBR } from "@/lib/dates";
import {
  type Cents,
  calculateLine,
  calculateQuote,
  type Discount,
  formatBRL,
  formatBRLInput,
  formatPercent,
  formatQuantity,
  type LineTotals,
  parseBRL,
  parsePercent,
  parseQuantity,
  type QuantityMilli,
  type QuoteTotals,
} from "@/lib/money";
import { normalizeForSearch } from "@/lib/search";

// Itens e opções do editor de orçamento (F-05, NBB-86/87/88). Funções puras, usadas no navegador
// (total na hora e campos destacados, P3-A) e no servidor (que valida de novo e recalcula, P2-A). A
// conta em si é a do src/lib/money.ts.

export type DiscountType = "percent" | "amount";

/** Um desconto como está na tela: o tipo (ou nenhum) e o texto digitado (RN-15a, RN-17). */
export type DiscountDraft = { type: DiscountType | null; value: string };

/** Um desconto como o banco guarda: pontos-base (percentual) ou centavos (valor). */
export type StoredDiscount = { type: DiscountType | null; value: number };

export const NO_DISCOUNT: DiscountDraft = { type: null, value: "" };

/**
 * Um item como está nos campos da tela: tudo texto, do jeito que a pessoa digitou. `catalogItemId`
 * é o item do catálogo de onde ele veio (C6-A, RN-11), ou nulo.
 */
export type ItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  catalogItemId: string | null;
  discount: DiscountDraft;
};

export type ItemField = "description" | "quantity" | "unit" | "unitPrice" | "discount";
/** Os campos do item que são um texto só (o desconto tem tipo e valor). */
export type ItemTextField = Exclude<ItemField, "discount">;
export type ItemErrors = Partial<Record<ItemField, string>>;

/** Um item já convertido: quantidade em milésimos e preço em centavos (nulo = sem preço, RN-13). */
export type ParsedItem = {
  id: string;
  description: string;
  quantityMilli: QuantityMilli;
  unit: string | null;
  unitPriceCents: Cents | null;
  catalogItemId: string | null;
  discount: StoredDiscount;
};

export type ParseItemResult = { ok: true; item: ParsedItem } | { ok: false; errors: ItemErrors };

/**
 * Confere e converte um desconto (G1-A, RN-15a, RN-17). Valor vazio é o mesmo que sem desconto. O
 * percentual vai de 0 a 100%, com até 2 casas; o valor fixo, em reais.
 */
export function parseDiscount(
  draft: DiscountDraft,
): { ok: true; discount: StoredDiscount } | { ok: false; error: string } {
  const text = draft.value.trim();
  if (draft.type === null || !text) {
    return { ok: true, discount: { type: null, value: 0 } };
  }
  if (draft.type === "percent") {
    const basisPoints = parsePercent(text);
    return basisPoints === null
      ? { ok: false, error: "Informe um percentual de 0 a 100, ex.: 10 ou 10,5" }
      : { ok: true, discount: { type: "percent", value: basisPoints } };
  }
  const cents = parseBRL(text);
  return cents === null
    ? { ok: false, error: "Informe um valor válido, ex.: 1.234,56" }
    : { ok: true, discount: { type: "amount", value: cents } };
}

/** O desconto guardado no formato que o money.ts calcula. */
export function toMoneyDiscount(discount: StoredDiscount): Discount | null {
  if (discount.type === "percent") return { type: "percent", basisPoints: discount.value };
  if (discount.type === "amount") return { type: "amount", cents: discount.value };
  return null;
}

/** O desconto guardado, de volta para o campo da tela: 1050 → "10,5"; 8000 → "80,00". */
export function toDiscountDraft(discount: StoredDiscount): DiscountDraft {
  if (discount.type === null) return NO_DISCOUNT;
  return {
    type: discount.type,
    value:
      discount.type === "percent"
        ? formatPercent(discount.value).replace("%", "")
        : formatBRLInput(discount.value),
  };
}

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

  const unit = draft.unit.trim();
  if (unit.length > QUOTE_LIMITS.itemUnit) {
    errors.unit = `Use até ${QUOTE_LIMITS.itemUnit} caracteres.`;
  }

  const priceText = draft.unitPrice.trim();
  const unitPriceCents = priceText ? parseBRL(priceText) : null;
  if (priceText && unitPriceCents === null) {
    errors.unitPrice = "Informe um valor válido, ex.: 1.234,56";
  } else if (unitPriceCents !== null && unitPriceCents > MAX_ITEM_PRICE_CENTS) {
    errors.unitPrice = `O valor pode ser de até ${formatBRL(MAX_ITEM_PRICE_CENTS)}.`;
  }

  const discount = parseDiscount(draft.discount);
  if (!discount.ok) {
    errors.discount = discount.error;
  }

  if (Object.keys(errors).length > 0 || quantityMilli === null || !discount.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    item: {
      id: draft.id,
      description,
      quantityMilli,
      unit: unit || null,
      unitPriceCents,
      catalogItemId: draft.catalogItemId,
      discount: discount.discount,
    },
  };
}

/** Totais de uma linha (RN-15, RN-15a). Sem preço, a linha vale zero até ser preenchida. */
export function lineTotals(item: ParsedItem): LineTotals {
  return calculateLine({
    quantityMilli: item.quantityMilli,
    unitPriceCents: item.unitPriceCents ?? 0,
    discount: toMoneyDiscount(item.discount),
  });
}

/** Totais do orçamento (RN-16 a RN-18): subtotal, desconto geral e total. */
export function quoteTotals(items: readonly ParsedItem[], discount: StoredDiscount): QuoteTotals {
  return calculateQuote(
    items.map((item) => ({
      quantityMilli: item.quantityMilli,
      unitPriceCents: item.unitPriceCents ?? 0,
      discount: toMoneyDiscount(item.discount),
    })),
    toMoneyDiscount(discount),
  );
}

/**
 * O desconto em valor fixo passou da base e foi limitado a ela (G6-A, RN-15a, RN-17)? O percentual
 * nunca passa, porque vai até 100%.
 */
export function isDiscountCapped(discount: StoredDiscount, baseCents: Cents): boolean {
  return discount.type === "amount" && discount.value > baseCents;
}

/** O desconto como aparece ao lado do total: "−10%" ou "−R$ 80,00". Vazio se não há. */
export function describeDiscount(discount: StoredDiscount, discountCents: Cents): string {
  if (discount.type === null || discountCents === 0) return "";
  return discount.type === "percent"
    ? `−${formatPercent(discount.value)}`
    : `−${formatBRL(discountCents)}`;
}

/** Um item novo, vazio, com quantidade 1. O id nasce no navegador (P2-A). */
export function newItemDraft(): ItemDraft {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unit: "",
    unitPrice: "",
    catalogItemId: null,
    discount: NO_DISCOUNT,
  };
}

/** Um item salvo, de volta para os campos da tela. */
export function toItemDraft(item: ParsedItem): ItemDraft {
  return {
    id: item.id,
    description: item.description,
    quantity: formatQuantity(item.quantityMilli),
    unit: item.unit ?? "",
    unitPrice: item.unitPriceCents === null ? "" : formatBRLInput(item.unitPriceCents),
    catalogItemId: item.catalogItemId,
    discount: toDiscountDraft(item.discount),
  };
}

/** Mensagem quando falta algo da RN-13 para baixar o PDF (editor e servidor usam a mesma). */
export const NOT_READY_TO_SEND_MESSAGE =
  "Para baixar o PDF, preencha a descrição e o valor de todos os itens.";

/** O que falta para enviar (RN-13): ao menos 1 item, todos com descrição e valor. */
export type SendCheck =
  { ok: true } | { ok: false; message: string; items: Record<string, ItemErrors> };

/**
 * Confere a RN-13 antes de baixar o PDF, que envia o orçamento (RN-22, NBB-51 P2-A). Os campos que
 * faltam ganham uma mensagem direta, como no F-05: "Informe o valor do item 2 para enviar.".
 */
export function checkReadyToSend(items: readonly ItemDraft[]): SendCheck {
  if (items.length === 0) {
    return { ok: false, message: "Adicione ao menos um item para enviar.", items: {} };
  }
  const errors: Record<string, ItemErrors> = {};
  items.forEach((item, index) => {
    const missing: ItemErrors = {};
    if (!item.description.trim()) {
      missing.description = `Informe a descrição do item ${index + 1} para enviar.`;
    }
    if (!item.unitPrice.trim()) {
      missing.unitPrice = `Informe o valor do item ${index + 1} para enviar.`;
    }
    if (Object.keys(missing).length > 0) {
      errors[item.id] = missing;
    }
  });
  return Object.keys(errors).length === 0
    ? { ok: true }
    : {
        ok: false,
        message: NOT_READY_TO_SEND_MESSAGE,
        items: errors,
      };
}

// ---------------------------------------------------------------------------
// "Mais opções" (G2-A): desconto geral, validade, condições, prazo, observações e anotações.
// ---------------------------------------------------------------------------

export type OptionsDraft = {
  discount: DiscountDraft;
  validUntil: string;
  paymentTerms: string;
  deliveryTime: string;
  notes: string;
  internalNotes: string;
};

export type OptionsField = keyof OptionsDraft;
export type OptionsErrors = Partial<Record<OptionsField, string>>;

export type ParsedOptions = {
  discount: StoredDiscount;
  validUntil: string;
  paymentTerms: string | null;
  deliveryTime: string | null;
  notes: string | null;
  internalNotes: string | null;
};

const OPTIONS_TEXT_LIMITS = {
  paymentTerms: QUOTE_LIMITS.paymentTerms,
  deliveryTime: QUOTE_LIMITS.deliveryTime,
  notes: QUOTE_LIMITS.notes,
  internalNotes: QUOTE_LIMITS.internalNotes,
} as const;

function isIsoDate(value: string): boolean {
  try {
    formatDateBR(value);
    return true;
  } catch {
    return false;
  }
}

/** Confere e converte as "Mais opções". A validade é obrigatória (RN-19, G5-A). */
export function parseOptions(
  draft: OptionsDraft,
): { ok: true; options: ParsedOptions } | { ok: false; errors: OptionsErrors } {
  const errors: OptionsErrors = {};

  const discount = parseDiscount(draft.discount);
  if (!discount.ok) {
    errors.discount = discount.error;
  }

  const validUntil = draft.validUntil.trim();
  if (!validUntil) {
    errors.validUntil = "Informe a validade.";
  } else if (!isIsoDate(validUntil)) {
    errors.validUntil = "Informe uma data válida.";
  }

  const texts = {} as Record<keyof typeof OPTIONS_TEXT_LIMITS, string | null>;
  for (const [field, max] of Object.entries(OPTIONS_TEXT_LIMITS) as [
    keyof typeof OPTIONS_TEXT_LIMITS,
    number,
  ][]) {
    const value = draft[field].trim();
    if (value.length > max) {
      errors[field] = `Use até ${max} caracteres.`;
    }
    texts[field] = value || null;
  }

  if (Object.keys(errors).length > 0 || !discount.ok) {
    return { ok: false, errors };
  }
  return { ok: true, options: { discount: discount.discount, validUntil, ...texts } };
}

/** As opções salvas, de volta para os campos da tela. */
export function toOptionsDraft(options: ParsedOptions): OptionsDraft {
  return {
    discount: toDiscountDraft(options.discount),
    validUntil: options.validUntil,
    paymentTerms: options.paymentTerms ?? "",
    deliveryTime: options.deliveryTime ?? "",
    notes: options.notes ?? "",
    internalNotes: options.internalNotes ?? "",
  };
}

// ---------------------------------------------------------------------------
// Catálogo no editor (NBB-87).
// ---------------------------------------------------------------------------

/** Um item do catálogo como o editor recebe (para as sugestões, C6-A). */
export type CatalogSuggestion = {
  id: string;
  name: string;
  unit: string | null;
  unitPriceCents: Cents | null;
};

/** Preenche o item com o que veio do catálogo: descrição, unidade, valor e a origem (C6-A). */
export function fillFromCatalog(item: ItemDraft, suggestion: CatalogSuggestion): ItemDraft {
  return {
    ...item,
    description: suggestion.name,
    unit: suggestion.unit ?? "",
    unitPrice: suggestion.unitPriceCents === null ? "" : formatBRLInput(suggestion.unitPriceCents),
    catalogItemId: suggestion.id,
  };
}

/** Até `limit` itens do catálogo cujo nome casa com o que foi digitado (sem acentos). */
export function suggestFromCatalog(
  catalog: readonly CatalogSuggestion[],
  term: string,
  limit = 6,
): CatalogSuggestion[] {
  const query = normalizeForSearch(term.trim());
  if (!query) return [];
  return catalog.filter((entry) => normalizeForSearch(entry.name).includes(query)).slice(0, limit);
}

/** Número do orçamento com 4 dígitos (RN-12): 1 → "0001". */
export function formatQuoteNumber(quoteNumber: number): string {
  return String(quoteNumber).padStart(4, "0");
}
