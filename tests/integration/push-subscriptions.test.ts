import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deletePushSubscription,
  markPushPrompted,
  savePushSubscription,
} from "@/features/push/push";
import { registerQuoteView, respondToQuote } from "@/features/public-quote/public-quote";
import { createQuote, saveQuoteItems, sendQuote } from "@/features/quotes/quotes";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { pushSubscriptions, user } from "@/lib/db/schema";
import type { FreelancerEvent, FreelancerTarget } from "@/lib/notify";

// Assinaturas de push (RN-45, NBB-61) contra o Postgres real: RLS (ENABLE + FORCE), gravar pela
// função (inclusive quando o navegador troca de conta), apagar e o aviso da resposta trazendo as
// assinaturas da conta (P3-A).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} para os testes de integração (veja .env.example).`);
  return value;
}

const owner = postgres(requireEnv("DATABASE_URL_OWNER"), { max: 1, onnotice: () => {} });
const emails: string[] = [];

async function createAccount(): Promise<string> {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const [created] = await getAuthDb()
    .insert(user)
    .values({ name: "Teste", email })
    .returning({ id: user.id });
  return created?.id ?? "";
}

/** Uma assinatura como o navegador entrega (`PushSubscription.toJSON()`), com endereço único. */
function subscription() {
  return {
    endpoint: `https://push.example.com/send/${randomUUID()}`,
    keys: { p256dh: `p256dh-${randomUUID()}`, auth: `auth-${randomUUID()}` },
  };
}

/** Um orçamento enviado da conta, e o token do link dele. */
async function sentQuoteToken(userId: string): Promise<string> {
  const created = await createQuote(userId);
  if (created.status !== "created") throw new Error("Orçamento não criado.");
  await saveQuoteItems(userId, created.id, {
    items: [
      {
        id: randomUUID(),
        description: "Logo",
        quantity: "1",
        unit: "",
        unitPrice: "800",
        catalogItemId: null,
      },
    ],
  });
  await sendQuote(userId, created.id);
  const [row] = await owner<{ public_token: string }[]>`
    select public_token from public.quotes where id = ${created.id}`;
  return row?.public_token ?? "";
}

async function endpointsOf(userId: string): Promise<string[]> {
  const rows = await withUserDb(userId, (tx) =>
    tx.select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions),
  );
  return rows.map((row) => row.endpoint);
}

let account = "";
let other = "";

beforeAll(async () => {
  account = await createAccount();
  other = await createAccount();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("push_subscriptions: RLS", () => {
  it("a tabela tem RLS ligada e forçada", async () => {
    const [table] = await owner<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      select relrowsecurity, relforcerowsecurity from pg_class
       where oid = 'public.push_subscriptions'::regclass`;
    expect(table).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });

  it("cada conta só vê e só apaga as próprias assinaturas", async () => {
    const mine = subscription();
    expect(await savePushSubscription(account, mine, "Mozilla/5.0")).toBe(true);

    expect(await endpointsOf(account)).toContain(mine.endpoint);
    expect(await endpointsOf(other)).not.toContain(mine.endpoint);

    // Outra conta tentando apagar: a RLS não deixa.
    await deletePushSubscription(other, mine.endpoint);
    expect(await endpointsOf(account)).toContain(mine.endpoint);

    await deletePushSubscription(account, mine.endpoint);
    expect(await endpointsOf(account)).not.toContain(mine.endpoint);
  });

  it("a app_user não grava nem altera direto na tabela, só pela função", async () => {
    const attempt = withUserDb(account, (tx) =>
      tx.insert(pushSubscriptions).values({
        userId: account,
        endpoint: subscription().endpoint,
        p256dh: "x",
        auth: "y",
      }),
    );
    await expect(attempt).rejects.toThrow();
  });
});

describe("savePushSubscription", () => {
  it("o mesmo navegador em outra conta: a assinatura passa para a conta atual", async () => {
    const device = subscription();
    await savePushSubscription(account, device, null);
    await savePushSubscription(other, device, null);

    expect(await endpointsOf(account)).not.toContain(device.endpoint);
    expect(await endpointsOf(other)).toContain(device.endpoint);
  });

  it("recusa endereço sem https e chaves faltando", async () => {
    expect(
      await savePushSubscription(account, { ...subscription(), endpoint: "http://x.com" }, null),
    ).toBe(false);
    expect(
      await savePushSubscription(account, { endpoint: subscription().endpoint, keys: {} }, null),
    ).toBe(false);
    expect(await savePushSubscription(account, "nada", null)).toBe(false);
  });
});

describe("aviso da resposta com as assinaturas (P3-A)", () => {
  it("a resposta registrada traz as assinaturas da conta dona do orçamento", async () => {
    const owned = await createAccount();
    const device = subscription();
    await savePushSubscription(owned, device, null);
    // Uma assinatura de outra conta não pode aparecer.
    await savePushSubscription(other, subscription(), null);

    const token = await sentQuoteToken(owned);

    let target: FreelancerTarget | null = null;
    const result = await respondToQuote(
      token,
      { decision: "approved", version: 1 },
      "200.152.1.1",
      null,
      (received) => {
        target = received;
      },
    );
    expect(result).toBe("ok");
    expect((target as FreelancerTarget | null)?.pushSubscriptions).toEqual([
      { endpoint: device.endpoint, p256dh: device.keys.p256dh, auth: device.keys.auth },
    ]);
  });

  it("apagar a conta apaga as assinaturas dela", async () => {
    const gone = await createAccount();
    const device = subscription();
    await savePushSubscription(gone, device, null);
    await getAuthDb().delete(user).where(eq(user.id, gone));

    const rows =
      await owner`select 1 from public.push_subscriptions where endpoint = ${device.endpoint}`;
    expect(rows).toHaveLength(0);
  });
});

describe("primeira visualização (PR 2, N4)", () => {
  it("só a primeira entrega o aviso, com as assinaturas e sem o e-mail da conta", async () => {
    const owned = await createAccount();
    const device = subscription();
    await savePushSubscription(owned, device, null);
    const token = await sentQuoteToken(owned);

    const notices: { target: FreelancerTarget; event: FreelancerEvent }[] = [];
    const collect = (target: FreelancerTarget, event: FreelancerEvent) => {
      notices.push({ target, event });
    };
    expect(await registerQuoteView(token, "200.152.1.2", "Mozilla/5.0", collect)).toBe(true);
    expect(await registerQuoteView(token, "200.152.1.3", "Mozilla/5.0", collect)).toBe(false);

    expect(notices).toEqual([
      {
        target: {
          accountEmail: null,
          emailNotifications: false,
          pushSubscriptions: [
            { endpoint: device.endpoint, p256dh: device.keys.p256dh, auth: device.keys.auth },
          ],
        },
        event: {
          type: "quote_viewed",
          quoteId: expect.any(String),
          number: expect.any(Number),
          clientName: null,
        },
      },
    ]);
  });
});

describe("markPushPrompted (F-18, N2)", () => {
  async function promptedAt(userId: string): Promise<Date | null> {
    const [row] = await owner<{ push_prompted_at: Date | null }[]>`
      select push_prompted_at from public.profiles where id = ${userId}`;
    return row?.push_prompted_at ?? null;
  }

  it("marca só a conta da sessão e guarda a primeira vez", async () => {
    const invited = await createAccount();
    const untouched = await createAccount();

    await markPushPrompted(invited);
    const first = await promptedAt(invited);
    expect(first).toBeInstanceOf(Date);
    expect(await promptedAt(untouched)).toBeNull();

    await markPushPrompted(invited);
    expect(await promptedAt(invited)).toEqual(first);
  });
});
