// Assinaturas de push (RN-45, ADR-0009, NBB-61 P4-A): uma por aparelho (navegador) que ativou as
// notificações. São dado pessoal (docs/07 §10.1): morrem com a conta e quando o serviço de push diz
// que expiraram (404/410). RLS: a app_user só vê e mexe nas assinaturas da própria conta; o envio,
// sem a sessão do freelancer, recebe as assinaturas pela app.respond_to_quote (P3-A, migration 0012).
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Tamanhos máximos (os endereços dos serviços de push têm algumas centenas de caracteres). */
export const PUSH_SUBSCRIPTION_LIMITS = {
  endpoint: 1000,
  key: 200,
  userAgent: 500,
} as const;

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // O endereço no serviço de push (Google, Apple, Mozilla): único, longo e secreto.
    endpoint: text("endpoint").notNull().unique(),
    // As chaves da assinatura, para cifrar a mensagem (Web Push).
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    check(
      "push_subscriptions_endpoint_format",
      sql`${table.endpoint} ~ '^https://' and char_length(${table.endpoint}) <= ${sql.raw(String(PUSH_SUBSCRIPTION_LIMITS.endpoint))}`,
    ),
    check(
      "push_subscriptions_keys_length",
      sql`char_length(${table.p256dh}) <= ${sql.raw(String(PUSH_SUBSCRIPTION_LIMITS.key))} and char_length(${table.auth}) <= ${sql.raw(String(PUSH_SUBSCRIPTION_LIMITS.key))}`,
    ),
    check(
      "push_subscriptions_user_agent_length",
      sql`char_length(${table.userAgent}) <= ${sql.raw(String(PUSH_SUBSCRIPTION_LIMITS.userAgent))}`,
    ),
  ],
);
