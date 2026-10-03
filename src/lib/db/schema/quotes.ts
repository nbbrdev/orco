// Orçamentos e seus itens (docs/05-dados.md, NBB-46). Cada linha pertence a uma conta e morre em
// cascata com ela. RLS: a app_user só vê e altera os orçamentos da própria conta.
//
// Fica no banco (migration 0006): a numeração (RN-12) e os valores iniciais (trigger
// app.prepare_new_quote), o token público (RN-30), as permissões de update por coluna e as FKs
// compostas. Os triggers de status, versão, trava e limites chegam no PR 2 da NBB-46.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { clients } from "./clients";
import { MAX_ITEM_PRICE_CENTS, QUOTE_LIMITS } from "./quote-limits";

export * from "./quote-limits";

/** Status guardado. "Expirado" não é guardado: é calculado pela validade (RN-26). */
export const quoteStatus = pgEnum("quote_status", ["draft", "sent", "approved", "rejected"]);

/** Tipo de desconto: percentual em pontos-base ou valor em centavos (RN-15a, RN-17, ADR-0006). */
export const discountType = pgEnum("discount_type", ["percent", "amount"]);

const length = (column: unknown, max: number) =>
  sql`char_length(${column}) <= ${sql.raw(String(max))}`;

// Desconto coerente: sem tipo, valor 0; percentual de 0 a 10.000 pontos-base; valor fixo ≥ 0.
const discountCheck = (type: unknown, value: unknown) =>
  sql`(${type} is null and ${value} = 0) or (${type} = 'percent' and ${value} between 0 and 10000) or (${type} = 'amount' and ${value} >= 0)`;

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Atribuído pelo trigger app.prepare_new_quote (RN-12). O 0 só existe para o insert do Drizzle
    // não exigir o campo: o trigger sempre troca pelo número certo.
    number: integer("number")
      .notNull()
      .$defaultFn(() => 0),
    status: quoteStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    // Referência ao cliente (navegação e RN-09). Os dados do cliente são a cópia abaixo (RN-20).
    clientId: uuid("client_id"),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    clientDocument: text("client_document"),
    clientAddress: text("client_address"),
    discountType: discountType("discount_type"),
    discountValue: bigint("discount_value", { mode: "number" }).notNull().default(0),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull().default(0),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull().default(0),
    validUntil: date("valid_until").notNull(),
    paymentTerms: text("payment_terms"),
    deliveryTime: text("delivery_time"),
    notes: text("notes"),
    // Privadas (RN-20a): nunca aparecem no PDF nem no link.
    internalNotes: text("internal_notes"),
    // Gerado pelo banco: 32 bytes aleatórios em base64url (RN-30, Q6-A). O trigger de criação sempre
    // gera um novo, mesmo que o app mande um.
    publicToken: text("public_token")
      .notNull()
      .default(sql`app.generate_public_token()`),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    responseSeenAt: timestamp("response_seen_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("quotes_user_id_number_key").on(table.userId, table.number),
    unique("quotes_public_token_key").on(table.publicToken),
    // Alvo das FKs compostas dos itens: um item só aponta para um orçamento da mesma conta.
    unique("quotes_id_user_id_key").on(table.id, table.userId),
    index("quotes_user_id_status_idx").on(table.userId, table.status),
    index("quotes_user_id_created_at_idx").on(table.userId, table.createdAt.desc()),
    index("quotes_client_id_idx").on(table.clientId),
    // O cliente precisa ser da mesma conta. NO ACTION (e não RESTRICT): impede excluir um cliente
    // com orçamentos (RN-09), mas deixa a cascata da exclusão de conta funcionar.
    foreignKey({
      name: "quotes_client_id_user_id_fk",
      columns: [table.clientId, table.userId],
      foreignColumns: [clients.id, clients.userId],
    }).onDelete("no action"),
    check("quotes_number_positive", sql`${table.number} >= 1`),
    check("quotes_version_positive", sql`${table.version} >= 1`),
    check("quotes_client_name_length", length(table.clientName, QUOTE_LIMITS.clientName)),
    check("quotes_client_email_length", length(table.clientEmail, QUOTE_LIMITS.clientEmail)),
    check("quotes_client_phone_length", length(table.clientPhone, QUOTE_LIMITS.clientPhone)),
    check(
      "quotes_client_document_format",
      sql`${table.clientDocument} ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'`,
    ),
    check("quotes_client_address_length", length(table.clientAddress, QUOTE_LIMITS.clientAddress)),
    check("quotes_discount", discountCheck(table.discountType, table.discountValue)),
    check(
      "quotes_totals",
      sql`${table.subtotalCents} >= 0 and ${table.discountCents} between 0 and ${table.subtotalCents} and ${table.totalCents} = ${table.subtotalCents} - ${table.discountCents}`,
    ),
    check("quotes_payment_terms_length", length(table.paymentTerms, QUOTE_LIMITS.paymentTerms)),
    check("quotes_delivery_time_length", length(table.deliveryTime, QUOTE_LIMITS.deliveryTime)),
    check("quotes_notes_length", length(table.notes, QUOTE_LIMITS.notes)),
    check("quotes_internal_notes_length", length(table.internalNotes, QUOTE_LIMITS.internalNotes)),
    check("quotes_public_token_format", sql`${table.publicToken} ~ '^[A-Za-z0-9_-]{43}$'`),
    check("quotes_view_count_positive", sql`${table.viewCount} >= 0`),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Repetido do orçamento para simplificar a RLS (docs/05).
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").notNull(),
    position: integer("position").notNull(),
    // Origem no catálogo (RN-11). A FK, com ON DELETE SET NULL só nesta coluna, é escrita à mão na
    // migration 0006, porque o Drizzle não gera esse formato.
    catalogItemId: uuid("catalog_item_id"),
    // Cópia do item (RN-20). Vazia é aceita no rascunho; o envio exige preenchida (RN-13, PR 2).
    description: text("description").notNull().default(""),
    unit: text("unit"),
    // numeric(12,3): até 3 casas decimais (RN-14, ADR-0006). No TypeScript, em milésimos inteiros.
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    // Nulo só no rascunho (RN-13).
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }),
    grossCents: bigint("gross_cents", { mode: "number" }).notNull().default(0),
    discountType: discountType("discount_type"),
    discountValue: bigint("discount_value", { mode: "number" }).notNull().default(0),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull().default(0),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quote_items_quote_id_position_idx").on(table.quoteId, table.position),
    index("quote_items_catalog_item_id_idx").on(table.catalogItemId),
    // O orçamento precisa ser da mesma conta; apagar o orçamento apaga os itens.
    foreignKey({
      name: "quote_items_quote_id_user_id_fk",
      columns: [table.quoteId, table.userId],
      foreignColumns: [quotes.id, quotes.userId],
    }).onDelete("cascade"),
    check("quote_items_position_positive", sql`${table.position} >= 0`),
    check(
      "quote_items_description_length",
      length(table.description, QUOTE_LIMITS.itemDescription),
    ),
    check("quote_items_unit_length", length(table.unit, QUOTE_LIMITS.itemUnit)),
    check("quote_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "quote_items_unit_price_range",
      sql`${table.unitPriceCents} between 0 and ${sql.raw(String(MAX_ITEM_PRICE_CENTS))}`,
    ),
    check("quote_items_discount", discountCheck(table.discountType, table.discountValue)),
    check(
      "quote_items_totals",
      sql`${table.grossCents} >= 0 and ${table.discountCents} between 0 and ${table.grossCents} and ${table.lineTotalCents} = ${table.grossCents} - ${table.discountCents}`,
    ),
  ],
);

export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
