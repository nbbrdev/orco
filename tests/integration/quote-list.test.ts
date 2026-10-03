import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveClient } from "@/features/clients/clients";
import { listQuotes, markResponseSeen } from "@/features/quotes/list";
import type { QuoteTab } from "@/features/quotes/list-filters";
import { createQuote, getQuoteForEditor, saveQuoteItems } from "@/features/quotes/quotes";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { quotes, user } from "@/lib/db/schema";

// A lista de orçamentos (F-09, NBB-48) contra o Postgres real: abas com o expirado calculado (L3-A,
// RN-26), ordem pela última atividade (L2-A), busca sem acentos e pelo número (L5-A), páginas de 50
// (L1-A) e o selo "novo" (RN-42, L4-A), que não reordena a lista.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} para os testes de integração (veja .env.example).`);
  return value;
}

const owner = postgres(requireEnv("DATABASE_URL_OWNER"), { max: 1, onnotice: () => {} });
const emails: string[] = [];
const emptyClient = { email: "", phone: "", document: "", address: "", internalNotes: "" };

async function createAccount(): Promise<string> {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const [created] = await getAuthDb()
    .insert(user)
    .values({ name: "Teste", email })
    .returning({ id: user.id });
  return created?.id ?? "";
}

async function newQuote(userId: string, clientId: string | null = null): Promise<string> {
  const result = await createQuote(userId, clientId);
  if (result.status !== "created") throw new Error("Orçamento não criado.");
  return result.id;
}

async function newClient(userId: string, name: string): Promise<string> {
  const result = await saveClient(userId, null, { ...emptyClient, name });
  if (result.status !== "saved") throw new Error("Cliente não criado.");
  return result.client.id;
}

const item = (description = "Logo") => ({
  id: randomUUID(),
  description,
  quantity: "1",
  unit: "",
  unitPrice: "800",
  catalogItemId: null,
});

/** Um orçamento enviado (com um item completo, RN-13). */
async function sentQuote(userId: string): Promise<string> {
  const id = await newQuote(userId);
  await saveQuoteItems(userId, id, { items: [item()] });
  await withUserDb(userId, (tx) =>
    tx.update(quotes).set({ status: "sent" }).where(eq(quotes.id, id)),
  );
  return id;
}

const ids = async (userId: string, tab: QuoteTab, search = "") =>
  (await listQuotes(userId, { tab, search })).quotes.map((quote) => quote.id);

async function updatedAt(id: string): Promise<Date> {
  const [row] = await owner<{ updated_at: Date }[]>`
    select updated_at from public.quotes where id = ${id}`;
  if (!row) throw new Error("Orçamento não encontrado.");
  return row.updated_at;
}

let userA = "";

beforeAll(async () => {
  userA = await createAccount();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("abas (L3-A)", () => {
  it("cada aba mostra o seu status; o expirado é o enviado vencido (RN-26)", async () => {
    const id = await createAccount();
    const draft = await newQuote(id);
    const sent = await sentQuote(id);
    const expired = await sentQuote(id);
    await owner`update public.quotes set valid_until = current_date - 2 where id = ${expired}`;
    const approved = await sentQuote(id);
    await owner`update public.quotes set status = 'approved' where id = ${approved}`;
    const rejected = await sentQuote(id);
    await owner`update public.quotes set status = 'rejected' where id = ${rejected}`;

    expect(await ids(id, "rascunhos")).toEqual([draft]);
    expect(await ids(id, "enviados")).toEqual([sent]);
    expect(await ids(id, "expirados")).toEqual([expired]);
    expect(await ids(id, "aprovados")).toEqual([approved]);
    expect(await ids(id, "recusados")).toEqual([rejected]);
    expect(new Set(await ids(id, "todos"))).toEqual(
      new Set([draft, sent, expired, approved, rejected]),
    );

    const [card] = (await listQuotes(id, { tab: "expirados", search: "" })).quotes;
    expect(card).toMatchObject({
      status: "expired",
      clientName: null,
      totalCents: 80000,
      viewedAt: null,
      isNew: false,
    });
  });

  it("orçamentos de outra conta não aparecem", async () => {
    const other = await createAccount();
    await newQuote(userA);
    expect(await ids(other, "todos")).toEqual([]);
  });
});

describe("ordem pela última atividade (L2-A)", () => {
  it("o orçamento editado por último vem primeiro, mesmo mexendo só nos itens", async () => {
    const id = await createAccount();
    const first = await newQuote(id);
    const second = await newQuote(id);
    const line = item("Logo");
    await saveQuoteItems(id, first, { items: [line] });
    await saveQuoteItems(id, second, { items: [item()] });
    expect(await ids(id, "todos")).toEqual([second, first]);

    // Só a descrição muda: os totais do orçamento são regravados iguais, e isso conta como atividade.
    await saveQuoteItems(id, first, { items: [{ ...line, description: "Logo novo" }] });
    expect(await ids(id, "todos")).toEqual([first, second]);
  });
});

describe("busca (L5-A)", () => {
  it("pelo nome do cliente, sem acentos nem maiúsculas", async () => {
    const id = await createAccount();
    const jose = await newQuote(id, await newClient(id, "José Álvares"));
    const maria = await newQuote(id, await newClient(id, "Maria 100% Silva"));
    await newQuote(id);

    expect(await ids(id, "todos", "jose")).toEqual([jose]);
    expect(await ids(id, "todos", "ALVA")).toEqual([jose]);
    // "%" e "_" valem como texto, não como curinga.
    expect(await ids(id, "todos", "100%")).toEqual([maria]);
    expect(await ids(id, "todos", "_")).toEqual([]);
    // A busca respeita a aba.
    expect(await ids(id, "enviados", "jose")).toEqual([]);
  });

  it("só dígitos busca o número exato", async () => {
    const id = await createAccount();
    const first = await newQuote(id);
    await newQuote(id);
    const [row] = await withUserDb(id, (tx) =>
      tx.select({ number: quotes.number }).from(quotes).where(eq(quotes.id, first)),
    );
    expect(await ids(id, "todos", `000${row?.number}`)).toEqual([first]);
    expect(await ids(id, "todos", "99999999999")).toEqual([]);
  });
});

describe("páginas de 50 (L1-A)", () => {
  it("traz 50 por vez e avisa se há mais", async () => {
    const id = await createAccount();
    for (let index = 0; index < 51; index++) {
      await newQuote(id);
    }
    const page = await listQuotes(id, { tab: "todos", search: "" });
    expect(page.quotes).toHaveLength(50);
    expect(page.hasMore).toBe(true);

    const next = await listQuotes(id, { tab: "todos", search: "" }, 50);
    expect(next.quotes).toHaveLength(1);
    expect(next.hasMore).toBe(false);
    expect(page.quotes.map((quote) => quote.id)).not.toContain(next.quotes[0]?.id);

    expect(await listQuotes(id, { tab: "todos", search: "" }, -1)).toEqual({
      quotes: [],
      hasMore: false,
    });
  });
});

describe('selo "novo" (RN-42, L4-A)', () => {
  it("aparece na resposta não vista e some ao abrir, sem reordenar a lista", async () => {
    const id = await createAccount();
    const answered = await sentQuote(id);
    await owner`update public.quotes set status = 'approved' where id = ${answered}`;
    const newer = await newQuote(id);

    const [, card] = (await listQuotes(id, { tab: "todos", search: "" })).quotes;
    expect(card).toMatchObject({ id: answered, status: "approved", isNew: true });
    expect((await getQuoteForEditor(id, answered))?.responseUnseen).toBe(true);

    const before = await updatedAt(answered);
    await markResponseSeen(id, answered);
    expect(await updatedAt(answered)).toEqual(before);
    expect(await ids(id, "todos")).toEqual([newer, answered]);
    expect((await listQuotes(id, { tab: "aprovados", search: "" })).quotes[0]?.isNew).toBe(false);
    expect((await getQuoteForEditor(id, answered))?.responseUnseen).toBe(false);

    // Marcar de novo, um id inválido ou um orçamento sem resposta não muda nada.
    await markResponseSeen(id, answered);
    await markResponseSeen(id, "x");
    await markResponseSeen(id, newer);
    const [row] = await owner<{ response_seen_at: Date | null }[]>`
      select response_seen_at from public.quotes where id = ${newer}`;
    expect(row?.response_seen_at).toBeNull();
  });

  it("visualizações do cliente (RN-35) não reordenam a lista", async () => {
    const id = await createAccount();
    const viewed = await sentQuote(id);
    const before = await updatedAt(viewed);
    await owner`update public.quotes set view_count = 1, first_viewed_at = '2026-10-03 15:00:00+00' where id = ${viewed}`;
    expect(await updatedAt(viewed)).toEqual(before);

    const [card] = (await listQuotes(id, { tab: "todos", search: "" })).quotes;
    expect(card?.viewedAt).toBe("2026-10-03T15:00:00.000Z");
  });
});
