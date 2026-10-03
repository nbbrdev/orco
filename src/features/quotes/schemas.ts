import { z } from "zod";

import { MAX_ITEMS_PER_QUOTE } from "@/lib/db/schema/quote-limits";

// Forma do que o editor manda ao salvar (NBB-86 P2-A): o orçamento inteiro, com os itens na ordem
// da tela e as "Mais opções" (NBB-88 G3-A). Os campos chegam como texto, do jeito que a pessoa
// digitou; quem confere e converte cada um é o parseItem/parseOptions (src/features/quotes/items.ts),
// o mesmo do navegador.

const discountSchema = z.object({
  type: z.enum(["percent", "amount"]).nullable(),
  value: z.string().max(50),
});

const longText = z.string().max(5000);

export const saveItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        description: longText,
        quantity: z.string().max(50),
        unit: z.string().max(50),
        unitPrice: z.string().max(50),
        catalogItemId: z.uuid().nullable(),
        discount: discountSchema.default({ type: null, value: "" }),
      }),
    )
    .max(MAX_ITEMS_PER_QUOTE)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  // Sem as opções, o salvamento mexe só nos itens e mantém o desconto geral que já está salvo.
  options: z
    .object({
      discount: discountSchema,
      validUntil: z.string().max(50),
      paymentTerms: longText,
      deliveryTime: longText,
      notes: longText,
      internalNotes: longText,
    })
    .optional(),
});

export type SaveItemsInput = z.input<typeof saveItemsSchema>;
