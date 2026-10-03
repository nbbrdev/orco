import "server-only";

import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import {
  type ItemErrors,
  itemsTotal,
  lineTotals,
  type ParsedItem,
  parseItem,
} from "@/features/quotes/items";
import { saveItemsSchema } from "@/features/quotes/schemas";
import { withUserDb } from "@/lib/db";
import { DB_ERROR_CODES, hasPostgresCode } from "@/lib/db/errors";
import {
  MAX_ITEMS_PER_QUOTE,
  MAX_QUOTES_PER_MONTH,
  profiles,
  quoteItems,
  quotes,
} from "@/lib/db/schema";
import { defaultValidUntil } from "@/lib/dates";
import { numericToQuantity, quantityToNumeric } from "@/lib/money";

// O "miolo" do editor de orçamento (F-05, NBB-86), sem nada do Next: lê e grava sempre pelo
// withUserDb, então a RLS garante que cada pessoa só alcança os próprios orçamentos. As regras de
// numeração, status, versão e limites ficam no banco (NBB-46); aqui só traduzimos os erros.

export const MONTHLY_LIMIT_MESSAGE = `Você chegou ao limite de ${MAX_QUOTES_PER_MONTH} orçamentos neste mês. O limite volta no dia 1º.`;
export const ITEM_LIMIT_MESSAGE = `Este orçamento chegou ao limite de ${MAX_ITEMS_PER_QUOTE} itens.`;
export const LOCKED_MESSAGE = "Este orçamento já foi respondido e não pode mais ser alterado.";

const quoteId = z.uuid();

export type CreateQuoteResult = { status: "created"; id: string } | { status: "limit" };

/**
 * Cria um rascunho com os padrões do perfil (NBB-46 Q9-A): validade (hoje + N dias, RN-19),
 * observações, condições de pagamento e prazo de execução (RN-44). Número, status e token vêm do
 * banco (app.prepare_new_quote).
 */
export async function createQuote(userId: string): Promise<CreateQuoteResult> {
  try {
    const id = await withUserDb(userId, async (tx) => {
      const [profile] = await tx
        .select({
          validityDays: profiles.defaultValidityDays,
          notes: profiles.defaultNotes,
          paymentTerms: profiles.defaultPaymentTerms,
          deliveryTime: profiles.defaultDeliveryTime,
        })
        .from(profiles)
        .where(eq(profiles.id, userId));
      if (!profile) {
        throw new Error("Perfil não encontrado para a conta da sessão.");
      }
      const [created] = await tx
        .insert(quotes)
        .values({
          userId,
          validUntil: defaultValidUntil(profile.validityDays),
          notes: profile.notes,
          paymentTerms: profile.paymentTerms,
          deliveryTime: profile.deliveryTime,
        })
        .returning({ id: quotes.id });
      if (!created) {
        throw new Error("O insert do orçamento não devolveu a linha.");
      }
      return created.id;
    });
    return { status: "created", id };
  } catch (error) {
    if (hasPostgresCode(error, DB_ERROR_CODES.monthlyQuoteLimit)) {
      return { status: "limit" };
    }
    throw error;
  }
}

export type EditorQuote = {
  id: string;
  number: number;
  status: "draft" | "sent" | "approved" | "rejected";
  items: ParsedItem[];
};

/** O orçamento e os itens, na ordem salva, para abrir o editor. `null` se não existe ou é de outra conta. */
export async function getQuoteForEditor(userId: string, id: string): Promise<EditorQuote | null> {
  if (!quoteId.safeParse(id).success) {
    return null;
  }
  return withUserDb(userId, async (tx) => {
    const [quote] = await tx
      .select({ id: quotes.id, number: quotes.number, status: quotes.status })
      .from(quotes)
      .where(eq(quotes.id, id));
    if (!quote) {
      return null;
    }
    const items = await tx
      .select({
        id: quoteItems.id,
        description: quoteItems.description,
        quantity: quoteItems.quantity,
        unitPriceCents: quoteItems.unitPriceCents,
      })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(asc(quoteItems.position), asc(quoteItems.createdAt));
    return {
      ...quote,
      items: items.map(({ quantity, ...item }) => ({
        ...item,
        quantityMilli: numericToQuantity(quantity),
      })),
    };
  });
}

export type SaveItemsResult =
  | { status: "saved"; totalCents: number }
  | { status: "invalid"; errors: Record<string, ItemErrors> }
  | { status: "limit" | "locked"; message: string }
  | { status: "not_found" };

/**
 * Salva os itens do orçamento como estão na tela (P2-A), numa transação só: apaga os que saíram,
 * atualiza os que já existiam, insere os novos, grava a ordem (R1-A) e recalcula o total. O banco
 * sobe a versão uma vez por transação, se o orçamento já foi enviado (RN-24).
 */
export async function saveQuoteItems(
  userId: string,
  id: string,
  input: unknown,
): Promise<SaveItemsResult> {
  const shape = saveItemsSchema.safeParse(input);
  if (!quoteId.safeParse(id).success) {
    return { status: "not_found" };
  }
  if (!shape.success) {
    return { status: "invalid", errors: {} };
  }

  const parsed: ParsedItem[] = [];
  const errors: Record<string, ItemErrors> = {};
  for (const draft of shape.data.items) {
    const result = parseItem(draft);
    if (result.ok) {
      parsed.push(result.item);
    } else {
      errors[draft.id] = result.errors;
    }
  }
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors };
  }

  const totalCents = itemsTotal(parsed);
  try {
    const found = await withUserDb(userId, async (tx) => {
      const [quote] = await tx.select({ id: quotes.id }).from(quotes).where(eq(quotes.id, id));
      if (!quote) {
        return false;
      }

      const ids = parsed.map((item) => item.id);
      await tx
        .delete(quoteItems)
        .where(
          ids.length > 0
            ? and(eq(quoteItems.quoteId, id), notInArray(quoteItems.id, ids))
            : eq(quoteItems.quoteId, id),
        );
      const existing = new Set(
        ids.length > 0
          ? (
              await tx
                .select({ id: quoteItems.id })
                .from(quoteItems)
                .where(and(eq(quoteItems.quoteId, id), inArray(quoteItems.id, ids)))
            ).map((row) => row.id)
          : [],
      );

      for (const [position, item] of parsed.entries()) {
        const totals = lineTotals(item);
        const values = {
          position,
          description: item.description,
          quantity: quantityToNumeric(item.quantityMilli),
          unitPriceCents: item.unitPriceCents,
          grossCents: totals.grossCents,
          lineTotalCents: totals.totalCents,
        };
        if (existing.has(item.id)) {
          await tx
            .update(quoteItems)
            .set(values)
            .where(and(eq(quoteItems.id, item.id), eq(quoteItems.quoteId, id)));
        } else {
          await tx.insert(quoteItems).values({ ...values, id: item.id, userId, quoteId: id });
        }
      }

      // Sem descontos ainda (chegam na NBB-88): o total é o subtotal.
      await tx
        .update(quotes)
        .set({ subtotalCents: totalCents, discountCents: 0, totalCents })
        .where(eq(quotes.id, id));
      return true;
    });
    return found ? { status: "saved", totalCents } : { status: "not_found" };
  } catch (error) {
    if (hasPostgresCode(error, DB_ERROR_CODES.quoteItemLimit)) {
      return { status: "limit", message: ITEM_LIMIT_MESSAGE };
    }
    if (hasPostgresCode(error, DB_ERROR_CODES.quoteLocked)) {
      return { status: "locked", message: LOCKED_MESSAGE };
    }
    throw error;
  }
}
