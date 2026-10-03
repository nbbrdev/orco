import "server-only";

import { and, desc, eq, gte, isNotNull, isNull, lt, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import {
  QUOTES_PAGE_SIZE,
  type QuoteListFilters,
  type QuoteTab,
  searchTarget,
} from "@/features/quotes/list-filters";
import { type DisplayStatus, displayStatus } from "@/features/quotes/status";
import { withUserDb } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { todayInAppTimeZone } from "@/lib/dates";

// A lista de orçamentos (F-09, NBB-48), sem nada do Next. O banco filtra, busca e pagina (L1-A),
// sempre pelo withUserDb: a RLS garante que cada pessoa só vê os próprios orçamentos.

/** Um cartão da lista (L4-A). */
export type QuoteCard = {
  id: string;
  number: number;
  clientName: string | null;
  totalCents: number;
  status: DisplayStatus;
  /** Primeira visualização do cliente (RN-35), em ISO; nulo se ainda não viu. */
  viewedAt: string | null;
  /** Respondido e ainda não visto pelo dono: o selo "novo" (RN-42). */
  isNew: boolean;
};

export type QuotePage = { quotes: QuoteCard[]; hasMore: boolean };

const offsetSchema = z.number().int().min(0).max(100_000);

/** Escapa os curingas do LIKE, para "%" e "_" digitados valerem como texto. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function tabCondition(tab: QuoteTab, today: string): SQL | undefined {
  switch (tab) {
    case "rascunhos":
      return eq(quotes.status, "draft");
    // "Expirado" não é guardado (RN-26): é um enviado com a validade antes de hoje.
    case "enviados":
      return and(eq(quotes.status, "sent"), gte(quotes.validUntil, today));
    case "expirados":
      return and(eq(quotes.status, "sent"), lt(quotes.validUntil, today));
    case "aprovados":
      return eq(quotes.status, "approved");
    case "recusados":
      return eq(quotes.status, "rejected");
    case "todos":
      return undefined;
  }
}

function searchCondition(search: string): SQL | undefined {
  const target = searchTarget(search);
  if (target.by === "number") {
    return eq(quotes.number, target.number);
  }
  if (target.by === "name") {
    // Sem acentos nem maiúsculas (L5-A): a app.normalize_search usa a extensão unaccent.
    const pattern = `%${escapeLike(target.text)}%`;
    return sql`app.normalize_search(${quotes.clientName}) like app.normalize_search(${pattern})`;
  }
  return undefined;
}

/**
 * Os orçamentos da aba e da busca, da última atividade para trás (L2-A), `QUOTES_PAGE_SIZE` por vez a
 * partir de `offset`.
 */
export async function listQuotes(
  userId: string,
  filters: QuoteListFilters,
  offset = 0,
): Promise<QuotePage> {
  if (!offsetSchema.safeParse(offset).success) {
    return { quotes: [], hasMore: false };
  }
  const now = new Date();
  const rows = await withUserDb(userId, (tx) =>
    tx
      .select({
        id: quotes.id,
        number: quotes.number,
        status: quotes.status,
        validUntil: quotes.validUntil,
        clientName: quotes.clientName,
        totalCents: quotes.totalCents,
        firstViewedAt: quotes.firstViewedAt,
        respondedAt: quotes.respondedAt,
        responseSeenAt: quotes.responseSeenAt,
      })
      .from(quotes)
      .where(
        and(tabCondition(filters.tab, todayInAppTimeZone(now)), searchCondition(filters.search)),
      )
      .orderBy(desc(quotes.updatedAt), desc(quotes.id))
      .limit(QUOTES_PAGE_SIZE + 1)
      .offset(offset),
  );
  return {
    quotes: rows.slice(0, QUOTES_PAGE_SIZE).map((row) => ({
      id: row.id,
      number: row.number,
      clientName: row.clientName,
      totalCents: row.totalCents,
      status: displayStatus(row.status, row.validUntil, now),
      viewedAt: row.firstViewedAt?.toISOString() ?? null,
      isNew: row.respondedAt !== null && row.responseSeenAt === null,
    })),
    hasMore: rows.length > QUOTES_PAGE_SIZE,
  };
}

/**
 * Marca a resposta do cliente como vista (RN-42, L4-A): o selo "novo" some. Só mexe num orçamento
 * respondido e ainda não visto; não muda a ordem da lista (migration 0008).
 */
export async function markResponseSeen(userId: string, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) {
    return;
  }
  await withUserDb(userId, (tx) =>
    tx
      .update(quotes)
      .set({ responseSeenAt: new Date() })
      .where(and(eq(quotes.id, id), isNotNull(quotes.respondedAt), isNull(quotes.responseSeenAt))),
  );
}
