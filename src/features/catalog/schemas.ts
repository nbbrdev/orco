import { z } from "zod";

import { CATALOG_ITEM_LIMITS, MAX_UNIT_PRICE_CENTS } from "@/lib/db/schema/catalog-items";
import { formatBRL, parseBRL } from "@/lib/money";
import { optionalText } from "@/lib/validation";

// Validação e limpeza do formulário de item do catálogo (F-16, NBB-45). Só o nome é obrigatório
// (RN-10). O preço chega como o texto digitado ("1.234,56") e sai em centavos (I2-A); vazio = sem
// preço. O navegador manda o que foi digitado, e o servidor valida de novo aqui.

const unitPrice = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return null;
    const cents = parseBRL(value);
    if (cents === null) {
      context.addIssue({ code: "custom", message: "Informe um preço válido, ex.: 1.234,56" });
      return z.NEVER;
    }
    if (cents > MAX_UNIT_PRICE_CENTS) {
      context.addIssue({
        code: "custom",
        message: `O preço pode ser de até ${formatBRL(MAX_UNIT_PRICE_CENTS)}.`,
      });
      return z.NEVER;
    }
    return cents;
  });

export const catalogItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do item.")
    .max(CATALOG_ITEM_LIMITS.name, `Use até ${CATALOG_ITEM_LIMITS.name} caracteres.`),
  unit: optionalText(CATALOG_ITEM_LIMITS.unit),
  unitPrice,
});

export type CatalogItemField = keyof z.output<typeof catalogItemSchema>;

/** Um item como a tela recebe. */
export type CatalogItemRow = {
  id: string;
  name: string;
  unit: string | null;
  unitPriceCents: number | null;
};
