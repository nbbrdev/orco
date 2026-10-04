import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { withUserDb } from "@/lib/db";
import { profiles, PUSH_SUBSCRIPTION_LIMITS, pushSubscriptions } from "@/lib/db/schema";

// As assinaturas de push do aparelho (RN-45, NBB-61 P4-A, P5): o botão "Notificações neste aparelho"
// do perfil grava e apaga a assinatura deste navegador, sempre pela conta da sessão (withUserDb).

/** A assinatura como o navegador entrega (`PushSubscription.toJSON()`), conferida no servidor. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(PUSH_SUBSCRIPTION_LIMITS.endpoint),
  keys: z.object({
    p256dh: z.string().min(1).max(PUSH_SUBSCRIPTION_LIMITS.key),
    auth: z.string().min(1).max(PUSH_SUBSCRIPTION_LIMITS.key),
  }),
});

/**
 * Grava a assinatura deste aparelho na conta. Se o navegador já estava em outra conta, a assinatura
 * passa para esta (app.save_push_subscription, migration 0012). Devolve se a entrada era válida.
 */
export async function savePushSubscription(
  userId: string,
  input: unknown,
  userAgent: string | null,
): Promise<boolean> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return false;
  }
  const { endpoint, keys } = parsed.data;
  const agent = userAgent ? userAgent.slice(0, PUSH_SUBSCRIPTION_LIMITS.userAgent) : null;
  await withUserDb(userId, (tx) =>
    tx.execute(
      sql`select app.save_push_subscription(${endpoint}, ${keys.p256dh}, ${keys.auth}, ${agent})`,
    ),
  );
  return true;
}

/**
 * A conta já viu o convite de notificações (F-18, RN-45, N2): ele não aparece mais. Guarda só a
 * primeira vez.
 */
export async function markPushPrompted(userId: string): Promise<void> {
  await withUserDb(userId, (tx) =>
    tx
      .update(profiles)
      .set({ pushPromptedAt: sql`now()` })
      .where(and(eq(profiles.id, userId), isNull(profiles.pushPromptedAt))),
  );
}

/** Apaga a assinatura deste aparelho. A RLS só deixa apagar as da própria conta. */
export async function deletePushSubscription(userId: string, endpoint: unknown): Promise<void> {
  const parsed = z.string().max(PUSH_SUBSCRIPTION_LIMITS.endpoint).safeParse(endpoint);
  if (!parsed.success) {
    return;
  }
  await withUserDb(userId, (tx) =>
    tx.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, parsed.data)),
  );
}
