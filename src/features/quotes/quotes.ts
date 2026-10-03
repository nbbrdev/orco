import "server-only";

import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { saveCatalogItem } from "@/features/catalog/catalog";
import { saveClient } from "@/features/clients/clients";
import {
  type CatalogSuggestion,
  type ItemDraft,
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
  catalogItems,
  clients,
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

/** A cópia dos dados do cliente guardada no orçamento (RN-20). */
export type QuoteClient = {
  id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
};

export type EditorQuote = {
  id: string;
  number: number;
  status: "draft" | "sent" | "approved" | "rejected";
  client: QuoteClient | null;
  items: ParsedItem[];
};

/** O orçamento e os itens, na ordem salva, para abrir o editor. `null` se não existe ou é de outra conta. */
export async function getQuoteForEditor(userId: string, id: string): Promise<EditorQuote | null> {
  if (!quoteId.safeParse(id).success) {
    return null;
  }
  return withUserDb(userId, async (tx) => {
    const [quote] = await tx
      .select({
        id: quotes.id,
        number: quotes.number,
        status: quotes.status,
        clientId: quotes.clientId,
        clientName: quotes.clientName,
        clientEmail: quotes.clientEmail,
        clientPhone: quotes.clientPhone,
        clientDocument: quotes.clientDocument,
        clientAddress: quotes.clientAddress,
      })
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
        unit: quoteItems.unit,
        unitPriceCents: quoteItems.unitPriceCents,
        catalogItemId: quoteItems.catalogItemId,
      })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(asc(quoteItems.position), asc(quoteItems.createdAt));
    return {
      id: quote.id,
      number: quote.number,
      status: quote.status,
      client:
        quote.clientName === null
          ? null
          : {
              id: quote.clientId,
              name: quote.clientName,
              email: quote.clientEmail,
              phone: quote.clientPhone,
              document: quote.clientDocument,
              address: quote.clientAddress,
            },
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

      // Item do catálogo excluído enquanto o editor estava aberto: o item continua, só sem a origem
      // (como faz o ON DELETE SET NULL, RN-11).
      const catalogIds = [
        ...new Set(parsed.flatMap((item) => (item.catalogItemId ? [item.catalogItemId] : []))),
      ];
      const existingCatalog = new Set(
        catalogIds.length > 0
          ? (
              await tx
                .select({ id: catalogItems.id })
                .from(catalogItems)
                .where(inArray(catalogItems.id, catalogIds))
            ).map((row) => row.id)
          : [],
      );

      for (const [position, item] of parsed.entries()) {
        const totals = lineTotals(item);
        const values = {
          position,
          description: item.description,
          quantity: quantityToNumeric(item.quantityMilli),
          unit: item.unit,
          unitPriceCents: item.unitPriceCents,
          catalogItemId:
            item.catalogItemId && existingCatalog.has(item.catalogItemId)
              ? item.catalogItemId
              : null,
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

export type SetClientResult =
  | { status: "saved"; client: QuoteClient | null }
  | { status: "locked"; message: string }
  | { status: "not_found" };

/**
 * Escolhe o cliente do orçamento (C2-A) ou tira (`clientId` nulo). Guarda uma cópia dos dados dele
 * (RN-20): mudar o cliente depois não muda este orçamento.
 */
export async function setQuoteClient(
  userId: string,
  id: string,
  clientId: string | null,
): Promise<SetClientResult> {
  if (
    !quoteId.safeParse(id).success ||
    (clientId !== null && !quoteId.safeParse(clientId).success)
  ) {
    return { status: "not_found" };
  }
  try {
    return await withUserDb(userId, async (tx) => {
      let client: QuoteClient | null = null;
      if (clientId !== null) {
        const [row] = await tx
          .select({
            id: clients.id,
            name: clients.name,
            email: clients.email,
            phone: clients.phone,
            document: clients.document,
            address: clients.address,
          })
          .from(clients)
          .where(eq(clients.id, clientId));
        if (!row) {
          return { status: "not_found" } as const;
        }
        client = row;
      }
      const updated = await tx
        .update(quotes)
        .set({
          clientId: client?.id ?? null,
          clientName: client?.name ?? null,
          clientEmail: client?.email ?? null,
          clientPhone: client?.phone ?? null,
          clientDocument: client?.document ?? null,
          clientAddress: client?.address ?? null,
        })
        .where(eq(quotes.id, id))
        .returning({ id: quotes.id });
      return updated.length > 0
        ? ({ status: "saved", client } as const)
        : ({ status: "not_found" } as const);
    });
  } catch (error) {
    if (hasPostgresCode(error, DB_ERROR_CODES.quoteLocked)) {
      return { status: "locked", message: LOCKED_MESSAGE };
    }
    throw error;
  }
}

export type CreateClientResult = SetClientResult | { status: "invalid" | "limit"; message: string };

/** "Criar 'Fulano'" (C4-A, RF-12): cria o cliente só com o nome (RN-07) e já o escolhe. */
export async function createClientForQuote(
  userId: string,
  id: string,
  name: string,
): Promise<CreateClientResult> {
  const created = await saveClient(userId, null, {
    name,
    email: "",
    phone: "",
    document: "",
    address: "",
    internalNotes: "",
  });
  if (created.status === "invalid") {
    return { status: "invalid", message: created.errors.name ?? "Nome inválido." };
  }
  if (created.status === "limit") {
    return { status: "limit", message: created.message };
  }
  if (created.status !== "saved") {
    return { status: "not_found" };
  }
  return setQuoteClient(userId, id, created.client.id);
}

export type SaveToCatalogResult =
  { status: "saved"; item: CatalogSuggestion } | { status: "invalid" | "limit"; message: string };

/**
 * "Salvar no catálogo" (C7-B): cria o item do catálogo a partir do item do orçamento (descrição,
 * unidade e valor). O editor liga o item a ele no próximo salvamento.
 */
export async function saveItemToCatalog(
  userId: string,
  draft: Pick<ItemDraft, "description" | "unit" | "unitPrice">,
): Promise<SaveToCatalogResult> {
  if (!draft.description.trim()) {
    return { status: "invalid", message: "Preencha a descrição para salvar no catálogo." };
  }
  const result = await saveCatalogItem(userId, null, {
    name: draft.description,
    unit: draft.unit,
    unitPrice: draft.unitPrice,
  });
  if (result.status === "saved") {
    return { status: "saved", item: result.item };
  }
  if (result.status === "limit") {
    return { status: "limit", message: result.message };
  }
  const message = result.status === "invalid" ? Object.values(result.errors)[0] : undefined;
  return { status: "invalid", message: message ?? "Não foi possível salvar no catálogo." };
}
