import "server-only";

import { and, asc, count, countDistinct, desc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { saveCatalogItem } from "@/features/catalog/catalog";
import { saveClient } from "@/features/clients/clients";
import {
  type CatalogSuggestion,
  type ItemDraft,
  type ItemErrors,
  lineTotals,
  type OptionsErrors,
  type ParsedItem,
  type ParsedOptions,
  parseItem,
  parseOptions,
  quoteTotals,
  type StoredDiscount,
} from "@/features/quotes/items";
import { saveItemsSchema } from "@/features/quotes/schemas";
import { type DisplayStatus, displayStatus } from "@/features/quotes/status";
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
 * banco (app.prepare_new_quote). Com `clientId` ("Novo orçamento para este cliente", NBB-87 D2-A),
 * já nasce com a cópia dos dados dele (RN-20); se o cliente não existir mais, nasce sem cliente.
 */
export async function createQuote(
  userId: string,
  clientId: string | null = null,
): Promise<CreateQuoteResult> {
  try {
    const id = await withUserDb(userId, async (tx) => {
      const [client] =
        clientId !== null && quoteId.safeParse(clientId).success
          ? await tx
              .select({
                clientId: clients.id,
                clientName: clients.name,
                clientEmail: clients.email,
                clientPhone: clients.phone,
                clientDocument: clients.document,
                clientAddress: clients.address,
              })
              .from(clients)
              .where(eq(clients.id, clientId))
          : [];
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
          ...client,
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
  /** Respondido e ainda não visto: ao abrir, o selo "novo" da lista some (RN-42, NBB-48 L4-A). */
  responseUnseen: boolean;
  /** "Mais opções" (NBB-88 G2-A). */
  options: ParsedOptions;
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
        discountType: quotes.discountType,
        discountValue: quotes.discountValue,
        validUntil: quotes.validUntil,
        paymentTerms: quotes.paymentTerms,
        deliveryTime: quotes.deliveryTime,
        notes: quotes.notes,
        internalNotes: quotes.internalNotes,
        respondedAt: quotes.respondedAt,
        responseSeenAt: quotes.responseSeenAt,
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
        discountType: quoteItems.discountType,
        discountValue: quoteItems.discountValue,
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
      items: items.map(({ quantity, discountType, discountValue, ...item }) => ({
        ...item,
        quantityMilli: numericToQuantity(quantity),
        discount: { type: discountType, value: discountValue },
      })),
      responseUnseen: quote.respondedAt !== null && quote.responseSeenAt === null,
      options: {
        discount: { type: quote.discountType, value: quote.discountValue },
        validUntil: quote.validUntil,
        paymentTerms: quote.paymentTerms,
        deliveryTime: quote.deliveryTime,
        notes: quote.notes,
        internalNotes: quote.internalNotes,
      },
    };
  });
}

export type SaveItemsResult =
  | { status: "saved"; totalCents: number }
  | { status: "invalid"; errors: Record<string, ItemErrors>; optionErrors?: OptionsErrors }
  | { status: "limit" | "locked"; message: string }
  | { status: "not_found" };

/**
 * Salva o orçamento como está na tela (P2-A, G3-A), numa transação só: apaga os itens que saíram,
 * atualiza os que já existiam, insere os novos, grava a ordem (R1-A) e as "Mais opções", e recalcula
 * os totais com os descontos (RN-15 a RN-18). Sem as opções, mantém o desconto geral já salvo. O
 * banco sobe a versão uma vez por transação, se o orçamento já foi enviado (RN-24).
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
  const options = shape.data.options ? parseOptions(shape.data.options) : null;
  if (Object.keys(errors).length > 0 || (options && !options.ok)) {
    return {
      status: "invalid",
      errors,
      ...(options && !options.ok ? { optionErrors: options.errors } : {}),
    };
  }

  try {
    const totalCents = await withUserDb(userId, async (tx) => {
      const [quote] = await tx
        .select({ discountType: quotes.discountType, discountValue: quotes.discountValue })
        .from(quotes)
        .where(eq(quotes.id, id));
      if (!quote) {
        return null;
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
          discountType: item.discount.type,
          discountValue: item.discount.value,
          grossCents: totals.grossCents,
          discountCents: totals.discountCents,
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

      const discount: StoredDiscount = options?.ok
        ? options.options.discount
        : { type: quote.discountType, value: quote.discountValue };
      const totals = quoteTotals(parsed, discount);
      await tx
        .update(quotes)
        .set({
          ...(options?.ok
            ? {
                discountType: discount.type,
                discountValue: discount.value,
                validUntil: options.options.validUntil,
                paymentTerms: options.options.paymentTerms,
                deliveryTime: options.options.deliveryTime,
                notes: options.options.notes,
                internalNotes: options.options.internalNotes,
              }
            : {}),
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
        })
        .where(eq(quotes.id, id));
      return totals.totalCents;
    });
    return totalCents === null ? { status: "not_found" } : { status: "saved", totalCents };
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

export type ClientQuote = {
  id: string;
  number: number;
  status: DisplayStatus;
  totalCents: number;
};

/** Os orçamentos de um cliente, do mais novo ao mais antigo (RF-13, NBB-87 D1-A). */
export async function listClientQuotes(userId: string, clientId: string): Promise<ClientQuote[]> {
  if (!quoteId.safeParse(clientId).success) {
    return [];
  }
  const rows = await withUserDb(userId, (tx) =>
    tx
      .select({
        id: quotes.id,
        number: quotes.number,
        status: quotes.status,
        validUntil: quotes.validUntil,
        totalCents: quotes.totalCents,
      })
      .from(quotes)
      .where(eq(quotes.clientId, clientId))
      .orderBy(desc(quotes.number)),
  );
  return rows.map(({ validUntil, status, ...quote }) => ({
    ...quote,
    status: displayStatus(status, validUntil),
  }));
}

/** Quantos rascunhos usam este cliente (RN-20, D3-A). */
export async function countClientDrafts(userId: string, clientId: string): Promise<number> {
  if (!quoteId.safeParse(clientId).success) {
    return 0;
  }
  const [row] = await withUserDb(userId, (tx) =>
    tx
      .select({ total: count() })
      .from(quotes)
      .where(and(eq(quotes.clientId, clientId), eq(quotes.status, "draft"))),
  );
  return row?.total ?? 0;
}

/**
 * "Atualizar também os N rascunhos deste cliente?" → Atualizar (RN-20, D3-A): copia os dados atuais
 * do cliente para os **rascunhos** que o usam. Enviados, aprovados e recusados nunca mudam.
 */
export async function updateClientDrafts(userId: string, clientId: string): Promise<number> {
  if (!quoteId.safeParse(clientId).success) {
    return 0;
  }
  return withUserDb(userId, async (tx) => {
    const [client] = await tx
      .select({
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
        clientDocument: clients.document,
        clientAddress: clients.address,
      })
      .from(clients)
      .where(eq(clients.id, clientId));
    if (!client) {
      return 0;
    }
    const updated = await tx
      .update(quotes)
      .set(client)
      .where(and(eq(quotes.clientId, clientId), eq(quotes.status, "draft")))
      .returning({ id: quotes.id });
    return updated.length;
  });
}

/** Quantos rascunhos usam este item do catálogo (RN-11, D4-A). */
export async function countCatalogItemDrafts(userId: string, itemId: string): Promise<number> {
  if (!quoteId.safeParse(itemId).success) {
    return 0;
  }
  const [row] = await withUserDb(userId, (tx) =>
    tx
      .select({ total: countDistinct(quoteItems.quoteId) })
      .from(quoteItems)
      .innerJoin(quotes, eq(quotes.id, quoteItems.quoteId))
      .where(and(eq(quoteItems.catalogItemId, itemId), eq(quotes.status, "draft"))),
  );
  return row?.total ?? 0;
}

/**
 * "Atualizar também os N rascunhos que usam este item?" → Atualizar (RN-11, D4-A): nas linhas dos
 * **rascunhos** ligadas ao item, troca descrição, unidade e valor (a quantidade e o desconto ficam) e
 * recalcula os totais da linha e do orçamento, com os descontos (NBB-88).
 */
export async function updateCatalogItemDrafts(userId: string, itemId: string): Promise<number> {
  if (!quoteId.safeParse(itemId).success) {
    return 0;
  }
  return withUserDb(userId, async (tx) => {
    const [entry] = await tx
      .select({
        name: catalogItems.name,
        unit: catalogItems.unit,
        unitPriceCents: catalogItems.unitPriceCents,
      })
      .from(catalogItems)
      .where(eq(catalogItems.id, itemId));
    if (!entry) {
      return 0;
    }
    const lines = await tx
      .select({
        id: quoteItems.id,
        quoteId: quoteItems.quoteId,
        quantity: quoteItems.quantity,
        discountType: quoteItems.discountType,
        discountValue: quoteItems.discountValue,
      })
      .from(quoteItems)
      .innerJoin(quotes, eq(quotes.id, quoteItems.quoteId))
      .where(and(eq(quoteItems.catalogItemId, itemId), eq(quotes.status, "draft")));

    for (const line of lines) {
      const totals = lineTotals({
        id: line.id,
        description: entry.name,
        quantityMilli: numericToQuantity(line.quantity),
        unit: entry.unit,
        unitPriceCents: entry.unitPriceCents,
        catalogItemId: itemId,
        discount: { type: line.discountType, value: line.discountValue },
      });
      await tx
        .update(quoteItems)
        .set({
          description: entry.name,
          unit: entry.unit,
          unitPriceCents: entry.unitPriceCents,
          grossCents: totals.grossCents,
          discountCents: totals.discountCents,
          lineTotalCents: totals.totalCents,
        })
        .where(eq(quoteItems.id, line.id));
    }

    const quoteIds = [...new Set(lines.map((line) => line.quoteId))];
    for (const id of quoteIds) {
      const [quote] = await tx
        .select({ discountType: quotes.discountType, discountValue: quotes.discountValue })
        .from(quotes)
        .where(eq(quotes.id, id));
      const quoteLines = await tx
        .select({
          quantity: quoteItems.quantity,
          unitPriceCents: quoteItems.unitPriceCents,
          discountType: quoteItems.discountType,
          discountValue: quoteItems.discountValue,
        })
        .from(quoteItems)
        .where(eq(quoteItems.quoteId, id));
      const totals = quoteTotals(
        quoteLines.map((quoteLine, index) => ({
          id: String(index),
          description: "",
          quantityMilli: numericToQuantity(quoteLine.quantity),
          unit: null,
          unitPriceCents: quoteLine.unitPriceCents,
          catalogItemId: null,
          discount: { type: quoteLine.discountType, value: quoteLine.discountValue },
        })),
        { type: quote?.discountType ?? null, value: quote?.discountValue ?? 0 },
      );
      await tx
        .update(quotes)
        .set({
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
        })
        .where(eq(quotes.id, id));
    }
    return quoteIds.length;
  });
}
