import { z } from "zod";

import { MAX_ITEMS_PER_QUOTE } from "@/lib/db/schema/quote-limits";

// Forma do que o editor manda ao salvar (NBB-86 P2-A): o orçamento inteiro, com os itens na ordem
// da tela. Os campos chegam como texto, do jeito que a pessoa digitou; quem confere e converte cada
// um é o parseItem (src/features/quotes/items.ts), o mesmo do navegador.

export const saveItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        description: z.string().max(5000),
        quantity: z.string().max(50),
        unit: z.string().max(50),
        unitPrice: z.string().max(50),
        catalogItemId: z.uuid().nullable(),
      }),
    )
    .max(MAX_ITEMS_PER_QUOTE)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
});

export type SaveItemsInput = z.input<typeof saveItemsSchema>;
