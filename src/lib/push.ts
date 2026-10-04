import "server-only";

import { sql } from "drizzle-orm";
import { sendNotification, WebPushError } from "web-push";

import type { PushMessage } from "@/features/push/messages";
import { getAppDb } from "@/lib/db";

// Envio de push (Web Push, RN-45, ADR-0009, NBB-61). Cada ambiente tem o seu par de chaves VAPID, lido
// do .env na hora (P2-A), sem entrar no build: as três chaves ficam juntas no .env da VPS, e trocá-las
// só pede reiniciar o container. Sem as chaves, o push fica desligado: o perfil mostra que o aparelho
// não recebe notificações e nada é enviado.

/** Uma assinatura: o endereço no serviço de push e as chaves para cifrar a mensagem. */
export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };

type Vapid = { publicKey: string; privateKey: string; subject: string };

function vapid(): Vapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/** A chave pública, para o navegador assinar (P2-A). Nula sem as chaves no .env. */
export function vapidPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

/** Quanto tempo o serviço de push guarda o aviso se o aparelho estiver desligado: 1 dia. */
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Manda o aviso para cada aparelho. Assinatura que o serviço diz não existir mais (404/410) é apagada
 * (P3-A). Nunca lança erro: quem chama é o notifyFreelancer (RN-42). O log não leva o endereço da
 * assinatura, que é secreto.
 */
export async function sendPush(
  subscriptions: PushSubscriptionKeys[],
  message: PushMessage,
): Promise<void> {
  const keys = vapid();
  if (!keys || subscriptions.length === 0) {
    return;
  }
  await Promise.all(
    subscriptions.map(async ({ endpoint, p256dh, auth }) => {
      try {
        await sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(message), {
          vapidDetails: keys,
          TTL: TTL_SECONDS,
          urgency: "high",
        });
      } catch (error) {
        const status = error instanceof WebPushError ? error.statusCode : null;
        if (status === 404 || status === 410) {
          await getAppDb()
            .execute(sql`select app.delete_push_subscription(${endpoint})`)
            .catch(() => console.error("Falha ao apagar uma assinatura de push vencida."));
          return;
        }
        console.error("Falha ao enviar um push.", { status });
      }
    }),
  );
}
