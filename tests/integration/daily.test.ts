import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/cron/diario/route";
import { sendDueReminders } from "@/features/reminders/daily";
import { createQuote, saveQuoteItems, sendQuote } from "@/features/quotes/quotes";
import { closeDb, getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";

// O agendamento diário (NBB-62) contra o Postgres e o Mailpit reais: quais orçamentos recebem o
// lembrete (RN-43), rodar duas vezes não duplica, prorrogar permite um novo, e a rota só abre com a
// CRON_SECRET certa.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} para os testes de integração (veja .env.example).`);
  return value;
}

const owner = postgres(requireEnv("DATABASE_URL_OWNER"), { max: 1, onnotice: () => {} });
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const emails: string[] = [];
let account = { id: "", email: "" };

async function createAccount() {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const [created] = await getAuthDb()
    .insert(user)
    .values({ name: "Teste", email })
    .returning({ id: user.id });
  return { id: created?.id ?? "", email };
}

/** Um orçamento com um item, enviado ou não, e a validade a `days` dias de hoje (São Paulo). */
async function quoteDueIn(days: number, { send = true } = {}): Promise<string> {
  const created = await createQuote(account.id);
  if (created.status !== "created") throw new Error("Orçamento não criado.");
  await saveQuoteItems(account.id, created.id, {
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
  if (send) await sendQuote(account.id, created.id);
  await setValidIn(created.id, days);
  return created.id;
}

async function setValidIn(id: string, days: number) {
  await owner`
    update public.quotes
       set valid_until = (now() at time zone 'America/Sao_Paulo')::date + ${days}::int
     where id = ${id}`;
}

async function remindedAt(id: string): Promise<Date | null> {
  const [row] = await owner<{ reminder_sent_at: Date | null }[]>`
    select reminder_sent_at from public.quotes where id = ${id}`;
  return row?.reminder_sent_at ?? null;
}

async function subjectsTo(email: string): Promise<string[]> {
  const response = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  const body = (await response.json()) as { messages: { Subject: string }[] };
  return body.messages.map((message) => message.Subject);
}

beforeAll(async () => {
  account = await createAccount();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("sendDueReminders (RN-43, L4-A)", () => {
  it("lembra só os enviados, sem resposta, que vencem amanhã; rodar de novo não duplica", async () => {
    const due = await quoteDueIn(1);
    const later = await quoteDueIn(2);
    const draft = await quoteDueIn(1, { send: false });
    const answered = await quoteDueIn(1);
    await owner`update public.quotes set status = 'approved' where id = ${answered}`;

    await sendDueReminders();
    expect(await remindedAt(due)).toBeInstanceOf(Date);
    expect(await remindedAt(later)).toBeNull();
    expect(await remindedAt(draft)).toBeNull();
    expect(await remindedAt(answered)).toBeNull();

    const reminded = (await subjectsTo(account.email)).filter((s) => s.includes("vence amanhã"));
    expect(reminded).toHaveLength(1);

    // Segunda rodada no mesmo dia: nada de novo.
    const first = await remindedAt(due);
    await sendDueReminders();
    expect(await remindedAt(due)).toEqual(first);
    expect(
      (await subjectsTo(account.email)).filter((s) => s.includes("vence amanhã")),
    ).toHaveLength(1);
  });

  it("prorrogar zera o lembrete, e o orçamento pode receber outro (RN-27, RN-43)", async () => {
    const id = await quoteDueIn(1);
    await sendDueReminders();
    expect(await remindedAt(id)).toBeInstanceOf(Date);

    await setValidIn(id, 10);
    expect(await remindedAt(id)).toBeNull();

    // A nova validade também chegou à véspera.
    await setValidIn(id, 1);
    await sendDueReminders();
    expect(await remindedAt(id)).toBeInstanceOf(Date);
  });
});

describe("POST /api/cron/diario (L2-A)", () => {
  const call = (authorization?: string) =>
    POST(
      new Request("http://localhost/api/cron/diario", {
        method: "POST",
        headers: authorization ? { authorization } : {},
      }),
    );

  it("sem a CRON_SECRET configurada, fica fechada (503)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer qualquer")).status).toBe(503);
  });

  it("sem a senha ou com a senha errada: 401", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-de-teste");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer errado")).status).toBe(401);
    expect((await call("segredo-de-teste")).status).toBe(401);
  });

  it("com a senha certa, faz as tarefas e devolve os números", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-de-teste");
    const id = await quoteDueIn(1);

    const response = await call("Bearer segredo-de-teste");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { reminders: number; anonymizedIps: number };
    expect(body.reminders).toBeGreaterThanOrEqual(1);
    expect(body.anonymizedIps).toBeGreaterThanOrEqual(0);
    expect(await remindedAt(id)).toBeInstanceOf(Date);
  });
});
