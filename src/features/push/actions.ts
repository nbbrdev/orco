"use server";

import { headers } from "next/headers";

import {
  deletePushSubscription,
  markPushPrompted,
  savePushSubscription,
} from "@/features/push/push";
import { requireSessionUser } from "@/lib/auth/session";

// Server Actions do botão "Notificações neste aparelho" (RN-45, NBB-61 P5). Casca fina sobre push.ts:
// a conta vem da sessão validada no servidor.

/** Grava a assinatura deste aparelho. Devolve se deu certo. */
export async function subscribePushAction(subscription: unknown): Promise<boolean> {
  const user = await requireSessionUser();
  try {
    return await savePushSubscription(user.id, subscription, (await headers()).get("user-agent"));
  } catch (error) {
    console.error("Falha ao gravar a assinatura de push.", error);
    return false;
  }
}

/** A conta já viu o convite de notificações (F-18, N2): ele não aparece mais. */
export async function markPushPromptedAction(): Promise<void> {
  const user = await requireSessionUser();
  try {
    await markPushPrompted(user.id);
  } catch (error) {
    console.error("Falha ao marcar o convite de notificações.", error);
  }
}

/** Apaga a assinatura deste aparelho. */
export async function unsubscribePushAction(endpoint: unknown): Promise<void> {
  const user = await requireSessionUser();
  try {
    await deletePushSubscription(user.id, endpoint);
  } catch (error) {
    console.error("Falha ao apagar a assinatura de push.", error);
  }
}
