import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type * as webPush from "web-push";
import { sendNotification, WebPushError } from "web-push";

import { savePushSubscription } from "@/features/push/push";
import { closeDb, getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { sendPush } from "@/lib/push";

// O envio de push (RN-45, NBB-61 P3-A, P7) com o serviço de push simulado: o `web-push` de verdade
// falaria com o Google ou a Apple. Confere a mensagem, a limpeza das assinaturas vencidas (404/410)
// e que o log não leva o endereço da assinatura.

vi.mock("web-push", async (importOriginal) => ({
  ...(await importOriginal<typeof webPush>()),
  sendNotification: vi.fn(),
}));

const send = vi.mocked(sendNotification);
const owner = postgres(process.env.DATABASE_URL_OWNER ?? "", { max: 1, onnotice: () => {} });
const emails: string[] = [];
let account = "";

const message = {
  title: "✅ Maria aprovou o orçamento Nº 0012",
  url: "/app/orcamentos/x",
  tag: "t",
};

function keys() {
  return {
    endpoint: `https://push.example.com/send/${randomUUID()}`,
    p256dh: `p256dh-${randomUUID()}`,
    auth: `auth-${randomUUID()}`,
  };
}

async function exists(endpoint: string): Promise<boolean> {
  const rows = await owner`select 1 from public.push_subscriptions where endpoint = ${endpoint}`;
  return rows.length > 0;
}

beforeAll(async () => {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const [created] = await getAuthDb()
    .insert(user)
    .values({ name: "Teste", email })
    .returning({ id: user.id });
  account = created?.id ?? "";
  vi.stubEnv("VAPID_PUBLIC_KEY", "chave-publica-de-teste");
  vi.stubEnv("VAPID_PRIVATE_KEY", "chave-privada-de-teste");
  vi.stubEnv("VAPID_SUBJECT", "https://orco.example.com");
});

afterEach(() => {
  send.mockReset();
  vi.restoreAllMocks();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("sendPush", () => {
  it("manda a mensagem para cada aparelho, com as chaves VAPID do ambiente", async () => {
    const [a, b] = [keys(), keys()];
    await sendPush([a, b], message);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
      JSON.stringify(message),
      expect.objectContaining({
        vapidDetails: {
          publicKey: "chave-publica-de-teste",
          privateKey: "chave-privada-de-teste",
          subject: "https://orco.example.com",
        },
      }),
    );
  });

  it("assinatura vencida (410) é apagada; a que funciona continua", async () => {
    const expired = keys();
    const alive = keys();
    for (const item of [expired, alive]) {
      await savePushSubscription(
        account,
        { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
        null,
      );
    }
    send.mockImplementation(async (subscription) => {
      if (subscription.endpoint === expired.endpoint) {
        throw new WebPushError("Gone", 410, {}, "", subscription.endpoint);
      }
      return { statusCode: 201, body: "", headers: {} };
    });

    await sendPush([expired, alive], message);
    expect(await exists(expired.endpoint)).toBe(false);
    expect(await exists(alive.endpoint)).toBe(true);
  });

  it("outro erro não lança e o log não leva o endereço da assinatura", async () => {
    const device = keys();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockRejectedValue(new WebPushError("Erro", 500, {}, "", device.endpoint));

    await expect(sendPush([device], message)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Falha ao enviar um push.", { status: 500 });
    expect(JSON.stringify(log.mock.calls)).not.toContain(device.endpoint);
  });

  it("sem as chaves VAPID, não manda nada", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    await sendPush([keys()], message);
    expect(send).not.toHaveBeenCalled();
    vi.stubEnv("VAPID_PRIVATE_KEY", "chave-privada-de-teste");
  });
});
