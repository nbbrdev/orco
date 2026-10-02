// Perfil do freelancer (docs/05-dados.md, F-14, NBB-42). Uma linha por conta, com o mesmo `id` de
// auth.user. Nasce pelo trigger app.handle_new_user (migration 0003) e morre em cascata com a conta.
// RLS: a app_user só lê e altera o próprio perfil; não insere nem apaga.
import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Limites de tamanho dos textos (docs/05). Os mesmos números valem no Zod (features/profile). */
export const PROFILE_LIMITS = {
  displayName: 80,
  businessName: 120,
  phone: 20,
  contactEmail: 254,
  website: 200,
  instagram: 60,
  paymentInfo: 500,
  defaultNotes: 2000,
  defaultPaymentTerms: 500,
  defaultDeliveryTime: 500,
} as const;

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    businessName: text("business_name"),
    document: text("document"),
    phone: text("phone"),
    contactEmail: text("contact_email"),
    logoPath: text("logo_path"),
    website: text("website"),
    instagram: text("instagram"),
    paymentInfo: text("payment_info"),
    defaultValidityDays: integer("default_validity_days").notNull().default(15),
    defaultNotes: text("default_notes"),
    defaultPaymentTerms: text("default_payment_terms"),
    defaultDeliveryTime: text("default_delivery_time"),
    nextQuoteNumber: integer("next_quote_number").notNull().default(1),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    pushPromptedAt: timestamp("push_prompted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "profiles_display_name_length",
      sql`char_length(${table.displayName}) <= ${sql.raw(String(PROFILE_LIMITS.displayName))}`,
    ),
    check(
      "profiles_business_name_length",
      sql`char_length(${table.businessName}) <= ${sql.raw(String(PROFILE_LIMITS.businessName))}`,
    ),
    // CPF (11 dígitos) ou CNPJ (12 letras/números + 2 dígitos; formato alfanumérico da Receita), sem
    // pontuação. O dígito verificador é conferido no servidor (RN-08, src/lib/document.ts).
    check(
      "profiles_document_format",
      sql`${table.document} ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'`,
    ),
    check(
      "profiles_phone_length",
      sql`char_length(${table.phone}) <= ${sql.raw(String(PROFILE_LIMITS.phone))}`,
    ),
    check(
      "profiles_contact_email_length",
      sql`char_length(${table.contactEmail}) <= ${sql.raw(String(PROFILE_LIMITS.contactEmail))}`,
    ),
    check(
      "profiles_website_format",
      sql`${table.website} ~ '^https?://' and char_length(${table.website}) <= ${sql.raw(String(PROFILE_LIMITS.website))}`,
    ),
    check(
      "profiles_instagram_length",
      sql`char_length(${table.instagram}) <= ${sql.raw(String(PROFILE_LIMITS.instagram))}`,
    ),
    check(
      "profiles_payment_info_length",
      sql`char_length(${table.paymentInfo}) <= ${sql.raw(String(PROFILE_LIMITS.paymentInfo))}`,
    ),
    check(
      "profiles_default_validity_days_range",
      sql`${table.defaultValidityDays} between 1 and 365`,
    ),
    check(
      "profiles_default_notes_length",
      sql`char_length(${table.defaultNotes}) <= ${sql.raw(String(PROFILE_LIMITS.defaultNotes))}`,
    ),
    check(
      "profiles_default_payment_terms_length",
      sql`char_length(${table.defaultPaymentTerms}) <= ${sql.raw(String(PROFILE_LIMITS.defaultPaymentTerms))}`,
    ),
    check(
      "profiles_default_delivery_time_length",
      sql`char_length(${table.defaultDeliveryTime}) <= ${sql.raw(String(PROFILE_LIMITS.defaultDeliveryTime))}`,
    ),
    check("profiles_next_quote_number_positive", sql`${table.nextQuoteNumber} >= 1`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
