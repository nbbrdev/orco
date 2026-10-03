// Catálogo de itens do freelancer (docs/05-dados.md, F-16, NBB-45). Cada linha pertence a uma conta
// e morre em cascata com ela. RLS: a app_user só vê e altera os itens da própria conta. O limite de
// 500 por conta (RN-38) é garantido pelo trigger app.enforce_catalog_item_limit (migration 0005).
import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Limites de tamanho dos textos (docs/05). Os mesmos números valem no Zod. */
export const CATALOG_ITEM_LIMITS = {
  name: 200,
  unit: 10,
} as const;

/** Maior preço aceito: R$ 9.999.999,99 (NBB-45 I3-A). O banco confere o mesmo número. */
export const MAX_UNIT_PRICE_CENTS = 999_999_999;

/** Quantos itens cada conta pode ter (RN-38). O trigger da migration 0005 usa o mesmo número. */
export const MAX_CATALOG_ITEMS_PER_USER = 500;

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit"),
    // Em centavos (ADR-0006). Nulo = item sem preço, preenchido no orçamento (RN-10, RN-13).
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("catalog_items_user_id_name_idx").on(table.userId, table.name),
    // Alvo da FK composta de quote_items (NBB-46, escrita à mão na migration 0006).
    unique("catalog_items_id_user_id_key").on(table.id, table.userId),
    check(
      "catalog_items_name_length",
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(CATALOG_ITEM_LIMITS.name))}`,
    ),
    check(
      "catalog_items_unit_length",
      sql`char_length(${table.unit}) <= ${sql.raw(String(CATALOG_ITEM_LIMITS.unit))}`,
    ),
    check(
      "catalog_items_unit_price_range",
      sql`${table.unitPriceCents} between 0 and ${sql.raw(String(MAX_UNIT_PRICE_CENTS))}`,
    ),
  ],
);

export type CatalogItem = typeof catalogItems.$inferSelect;
