import { subscribePushAction, unsubscribePushAction } from "@/features/push/actions";

// O push deste aparelho, no navegador (RN-45, NBB-61): usado pelo botão do perfil, pelo convite depois
// do primeiro envio (F-18) e pelo Sair (N5). Cada navegador é uma assinatura.

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** A chave pública VAPID vem em base64url; o navegador quer os bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A assinatura deste navegador, se houver. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export type SubscribeResult = "on" | "denied" | "dismissed" | "failed";

export const SUBSCRIBE_FAILED_MESSAGE = "Não foi possível ativar as notificações. Tente de novo.";

/**
 * Liga as notificações neste aparelho: pede a permissão (precisa vir de um toque da pessoa), assina e
 * grava a assinatura na conta.
 */
export async function subscribeThisDevice(vapidPublicKey: string): Promise<SubscribeResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "dismissed";
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(vapidPublicKey),
  });
  if (await subscribePushAction(subscription.toJSON())) {
    return "on";
  }
  await subscription.unsubscribe();
  return "failed";
}

/** Desliga as notificações neste aparelho: cancela a assinatura aqui e apaga no servidor. */
export async function unsubscribeThisDevice(): Promise<void> {
  const subscription = await currentSubscription();
  if (subscription) {
    const { endpoint } = subscription;
    await subscription.unsubscribe();
    await unsubscribePushAction(endpoint);
  }
}
