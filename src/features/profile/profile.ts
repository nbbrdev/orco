import "server-only";

import { eq } from "drizzle-orm";

import {
  type ProfileField,
  profileFieldSchemas,
  type ProfileValues,
} from "@/features/profile/schemas";
import { withUserDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

// O "miolo" do perfil (F-14, NBB-42), sem nada do Next: lê e grava sempre pelo withUserDb, então a
// RLS garante que cada pessoa só alcança o próprio perfil. O `userId` vem da sessão validada.

/**
 * Os campos editáveis do perfil da pessoa e o logo (NBB-81). O perfil sempre existe: nasce com a
 * conta (D1).
 */
export async function getProfile(
  userId: string,
): Promise<ProfileValues & { logoPath: string | null }> {
  const [row] = await withUserDb(userId, (tx) =>
    tx.select().from(profiles).where(eq(profiles.id, userId)),
  );
  if (!row) {
    throw new Error("Perfil não encontrado para a conta da sessão.");
  }
  return {
    logoPath: row.logoPath,
    displayName: row.displayName,
    businessName: row.businessName,
    phone: row.phone,
    contactEmail: row.contactEmail,
    website: row.website,
    instagram: row.instagram,
    document: row.document,
    paymentInfo: row.paymentInfo,
    defaultValidityDays: row.defaultValidityDays,
    defaultNotes: row.defaultNotes,
    defaultPaymentTerms: row.defaultPaymentTerms,
    defaultDeliveryTime: row.defaultDeliveryTime,
    emailNotifications: row.emailNotifications,
  };
}

export type UpdateFieldResult =
  { status: "saved"; value: ProfileValues[ProfileField] } | { status: "invalid"; message: string };

/** Valida e grava um campo (D3). Devolve o valor como ficou salvo (já limpo, D4). */
export async function updateProfileField(
  userId: string,
  field: ProfileField,
  value: unknown,
): Promise<UpdateFieldResult> {
  const parsed = profileFieldSchemas[field].safeParse(value);
  if (!parsed.success) {
    return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Valor inválido." };
  }
  await withUserDb(userId, (tx) =>
    tx
      .update(profiles)
      .set({ [field]: parsed.data })
      .where(eq(profiles.id, userId)),
  );
  return { status: "saved", value: parsed.data };
}
