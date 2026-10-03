// Limites dos orçamentos (docs/05, RN-14, RN-38). Ficam num arquivo sem Drizzle para a tela poder
// usá-los sem carregar o schema do banco no navegador. O schema (quotes.ts), os triggers (migrations
// 0006 e 0007) e o Zod usam os mesmos números.

/** Limites de tamanho dos textos. */
export const QUOTE_LIMITS = {
  clientName: 120,
  clientEmail: 254,
  clientPhone: 20,
  clientAddress: 300,
  paymentTerms: 500,
  deliveryTime: 500,
  notes: 2000,
  internalNotes: 2000,
  itemDescription: 500,
  itemUnit: 10,
} as const;

/** Maior valor unitário de um item: R$ 9.999.999,99, o mesmo teto do catálogo (NBB-45 I3-A). */
export const MAX_ITEM_PRICE_CENTS = 999_999_999;

/** Itens por orçamento (RN-14), conferido pelo trigger app.check_quote_item_change. */
export const MAX_ITEMS_PER_QUOTE = 100;

/** Orçamentos criados por mês (RN-38), conferido pelo trigger app.prepare_new_quote. */
export const MAX_QUOTES_PER_MONTH = 200;
