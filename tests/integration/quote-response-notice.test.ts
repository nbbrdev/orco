import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { respondToQuote } from "@/features/public-quote/public-quote";
import { createQuote, saveQuoteItems, sendQuote } from "@/features/quotes/quotes";
import { closeDb, getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { type FreelancerEvent, type FreelancerTarget, notifyFreelancer } from "@/lib/notify";

// O aviso ao freelancer quando o cliente responde (RN-40 a RN-42, NBB-55) contra o Postgres e o
// Mailpit reais: a resposta entrega o e-mail da conta e a preferência (E1-A), e o notifyFreelancer
// manda o e-mail só com as notificações ligadas (RN-41).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} para os testes de integração (veja .env.example).`);
  return value;
}

const owner = postgres(requireEnv("DATABASE_URL_OWNER"), { max: 1, onnotice: () => {} });
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const emails: string[] = [];

type Account = { id: string; email: string };

async function createAccount(): Promise<Account> {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const [created] = await getAuthDb()
    .insert(user)
    .values({ name: "Teste", email })
    .returning({ id: user.id });
  return { id: created?.id ?? "", email };
}

async function sentQuote(userId: string) {
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
  expect(await sendQuote(userId, created.id)).toBe("sent");
  const [row] = await owner<{ public_token: string }[]>`
    select public_token from public.quotes where id = ${created.id}`;
  return { id: created.id, token: row?.public_token ?? "" };
}

const someIp = () =>
  `200.151.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

/** Assuntos dos e-mails que chegaram ao Mailpit para `email`. */
async function subjectsTo(email: string): Promise<string[]> {
  const response = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  const body = (await response.json()) as { messages: { Subject: string }[] };
  return body.messages.map((message) => message.Subject);
}

/** Responde e devolve o aviso que a resposta entregou (ou nulo). */
async function respond(token: string, input: unknown) {
  let notice: { target: FreelancerTarget; event: FreelancerEvent } | null = null;
  const result = await respondToQuote(token, input, someIp(), null, (target, event) => {
    notice = { target, event };
  });
  return { result, notice: notice as { target: FreelancerTarget; event: FreelancerEvent } | null };
}

let account: Account;

beforeAll(async () => {
  account = await createAccount();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("aviso da resposta (E1-A)", () => {
  it("a resposta registrada entrega o e-mail da conta, a preferência e o orçamento", async () => {
    const { id, token } = await sentQuote(account.id);
    const { result, notice } = await respond(token, {
      decision: "approved",
      version: 1,
      respondentName: "Maria",
    });
    expect(result).toBe("ok");
    expect(notice).toEqual({
      target: { accountEmail: account.email, emailNotifications: true },
      event: {
        type: "quote_response",
        quoteId: id,
        number: expect.any(Number),
        decision: "approved",
        respondentName: "Maria",
        clientName: null,
        reasonCode: null,
        reason: null,
      },
    });
  });

  it("sem resposta registrada, não há aviso", async () => {
    const { token } = await sentQuote(account.id);
    await respond(token, { decision: "approved", version: 1 });
    // Segunda resposta: já respondido.
    expect(await respond(token, { decision: "rejected", version: 1 })).toEqual({
      result: "already_responded",
      notice: null,
    });
    expect(await respond(token, { decision: "talvez", version: 1 })).toEqual({
      result: "invalid",
      notice: null,
    });
  });
});

describe("notifyFreelancer (RN-40, RN-41)", () => {
  it("manda o e-mail da aprovação e o da recusa com o motivo para a conta", async () => {
    const approved = await sentQuote(account.id);
    const first = await respond(approved.token, {
      decision: "approved",
      version: 1,
      respondentName: "Maria",
    });
    const rejected = await sentQuote(account.id);
    const second = await respond(rejected.token, {
      decision: "rejected",
      version: 1,
      reasonCode: "price",
    });
    for (const { notice } of [first, second]) {
      if (!notice) throw new Error("Sem aviso.");
      await notifyFreelancer(notice.target, notice.event);
    }

    const subjects = await subjectsTo(account.email);
    expect(subjects).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Maria aprovou o orçamento Nº \d{4}$/),
        expect.stringMatching(/^Seu cliente recusou o orçamento Nº \d{4}$/),
      ]),
    );
  });

  it("com as notificações desligadas no perfil, não manda nada (RN-41)", async () => {
    const quiet = await createAccount();
    await owner`update public.profiles set email_notifications = false where id = ${quiet.id}`;
    const { token } = await sentQuote(quiet.id);
    const { notice } = await respond(token, { decision: "approved", version: 1 });
    if (!notice) throw new Error("Sem aviso.");
    expect(notice.target.emailNotifications).toBe(false);

    await notifyFreelancer(notice.target, notice.event);
    expect(await subjectsTo(quiet.email)).toEqual([]);
  });
});
