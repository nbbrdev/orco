// Eventos do link público (docs/05-dados.md, NBB-52): visualização (RN-35), aprovação e recusa
// (RN-34). Só as funções `SECURITY DEFINER` da migration 0009 escrevem aqui; a app_user só lê os
// eventos dos próprios orçamentos, e nunca a coluna `ip` (D8-A).
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  inet,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { QUOTE_EVENT_LIMITS } from "./quote-limits";
import { quotes } from "./quotes";

export const quoteEventType = pgEnum("quote_event_type", ["viewed", "approved", "rejected"]);

/** Motivo rápido da recusa (RN-33): Preço, Prazo, Desisti, Outro. */
export const rejectReason = pgEnum("reject_reason", ["price", "deadline", "gave_up", "other"]);

const length = (column: unknown, max: number) =>
  sql`char_length(${column}) <= ${sql.raw(String(max))}`;

export const quoteEvents = pgTable(
  "quote_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id").notNull(),
    // Dono do orçamento, repetido para a RLS (como em quote_items).
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: quoteEventType("type").notNull(),
    // A versão que o cliente viu ou respondeu (RN-24, RN-34).
    quoteVersion: integer("quote_version").notNull(),
    // Apagado depois de 12 meses (RN-37, D6-A). A app_user não lê esta coluna (D8-A).
    ip: inet("ip"),
    userAgent: text("user_agent"),
    respondentName: text("respondent_name"),
    reasonCode: rejectReason("reason_code"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quote_events_quote_id_created_at_idx").on(table.quoteId, table.createdAt),
    // Para a anonimização dos IPs antigos (RN-37).
    index("quote_events_created_at_idx").on(table.createdAt),
    // O orçamento precisa ser da mesma conta; apagar o orçamento apaga os eventos.
    foreignKey({
      name: "quote_events_quote_id_user_id_fk",
      columns: [table.quoteId, table.userId],
      foreignColumns: [quotes.id, quotes.userId],
    }).onDelete("cascade"),
    check("quote_events_version_positive", sql`${table.quoteVersion} >= 1`),
    check("quote_events_user_agent_length", length(table.userAgent, QUOTE_EVENT_LIMITS.userAgent)),
    check(
      "quote_events_respondent_name_length",
      length(table.respondentName, QUOTE_EVENT_LIMITS.respondentName),
    ),
    check("quote_events_reason_length", length(table.reason, QUOTE_EVENT_LIMITS.reason)),
  ],
);

export type QuoteEvent = typeof quoteEvents.$inferSelect;
