// Clientes do freelancer (docs/05-dados.md, F-15, NBB-44). Cada linha pertence a uma conta e morre em
// cascata com ela. RLS: a app_user só vê e altera os clientes da própria conta. O limite de 1.000 por
// conta (RN-38) é garantido pelo trigger app.enforce_client_limit (migration 0004).
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Limites de tamanho dos textos (docs/05, NBB-44 K2). Os mesmos números valem no Zod. */
export const CLIENT_LIMITS = {
  name: 120,
  email: 254,
  phone: 20,
  address: 300,
  internalNotes: 2000,
} as const;

/** Quantos clientes cada conta pode ter (RN-38). O trigger da migration 0004 usa o mesmo número. */
export const MAX_CLIENTS_PER_USER = 1000;

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    document: text("document"),
    address: text("address"),
    // Privadas (RN-07): nunca aparecem no orçamento, no PDF ou no link, nem entram no snapshot.
    internalNotes: text("internal_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("clients_user_id_name_idx").on(table.userId, table.name),
    // Alvo da FK composta de quotes (NBB-46): um orçamento só aponta para um cliente da mesma conta.
    unique("clients_id_user_id_key").on(table.id, table.userId),
    check(
      "clients_name_length",
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(CLIENT_LIMITS.name))}`,
    ),
    check(
      "clients_email_length",
      sql`char_length(${table.email}) <= ${sql.raw(String(CLIENT_LIMITS.email))}`,
    ),
    check(
      "clients_phone_length",
      sql`char_length(${table.phone}) <= ${sql.raw(String(CLIENT_LIMITS.phone))}`,
    ),
    // Mesmo formato do perfil: CPF (11 dígitos) ou CNPJ (12 letras/números + 2 dígitos), sem
    // pontuação. O dígito verificador é conferido no servidor (RN-08, src/lib/document.ts).
    check("clients_document_format", sql`${table.document} ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'`),
    check(
      "clients_address_length",
      sql`char_length(${table.address}) <= ${sql.raw(String(CLIENT_LIMITS.address))}`,
    ),
    check(
      "clients_internal_notes_length",
      sql`char_length(${table.internalNotes}) <= ${sql.raw(String(CLIENT_LIMITS.internalNotes))}`,
    ),
  ],
);

export type Client = typeof clients.$inferSelect;
