import { randomUUID } from "node:crypto";

import { asc, eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveCatalogItem } from "@/features/catalog/catalog";
import { saveClient } from "@/features/clients/clients";
import { listQuotes } from "@/features/quotes/list";
import { deleteQuote, duplicateQuote } from "@/features/quotes/manage";
import { createQuote, getQuoteForEditor, saveQuoteItems } from "@/features/quotes/quotes";
import { updateProfileField } from "@/features/profile/profile";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { quoteItems, quotes, user } from "@/lib/db/schema";
import { addDays, defaultValidUntil, todayInAppTimeZone } from "@/lib/dates";

// Duplicar, excluir e prorrogar (F-11 a F-13, NBB-49) contra o Postgres real: o que a cópia leva e
// o que não leva (RN-28, P2-A), o limite do mês (P3), a exclusão em qualquer status (RN-29) e a
// prorrogação pelo salvamento do editor, que devolve o expirado a enviado e sobe a versão (RN-27, P6-A).

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

const item = (
  description: string,
  unitPrice: string,
  discount: { type: string | null; value: string } = { type: null, value: "" },
) => ({
  id: randomUUID(),
  description,
  quantity: "1",
  unit: "",
  unitPrice,
  catalogItemId: null as string | null,
  discount,
});

const options = (values: Record<string, unknown> = {}) => ({
  discount: { type: "amount", value: "220" },
  validUntil: "2026-12-31",
  paymentTerms: "50% na entrada",
  deliveryTime: "15 dias úteis",
  notes: "Valores sem impostos.",
  internalNotes: "Cliente pediu desconto",
  ...values,
});

/** Um orçamento enviado (com um item completo, RN-13). */
async function sentQuote(userId: string): Promise<string> {
  const id = await newQuote(userId);
  await saveQuoteItems(userId, id, { items: [item("Logo", "800")] });
  await withUserDb(userId, (tx) =>
    tx.update(quotes).set({ status: "sent" }).where(eq(quotes.id, id)),
  );
  return id;
}

let userA = "";
let userB = "";

beforeAll(async () => {
  userA = await createAccount();
  userB = await createAccount();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("duplicateQuote (RN-28, P2-A)", () => {
  it("copia itens, descontos e textos; recalcula a validade; não leva as anotações internas", async () => {
    const id = await createAccount();
    await updateProfileField(id, "defaultValidityDays", "30");
    const created = await saveClient(id, null, { ...emptyClient, name: "Maria Silva" });
    if (created.status !== "saved") throw new Error("Cliente não criado.");
    const catalog = await saveCatalogItem(id, null, { name: "Logo", unit: "", unitPrice: "800" });
    if (catalog.status !== "saved") throw new Error("Item não criado.");

    const original = await newQuote(id, created.client.id);
    const logo = {
      ...item("Logo", "800", { type: "percent", value: "10" }),
      catalogItemId: catalog.item.id,
    };
    await saveQuoteItems(id, original, {
      items: [logo, item("Site", "2.000")],
      options: options(),
    });
    // O cliente muda depois: a cópia leva os dados atuais do cadastro (P2-A).
    await saveClient(id, created.client.id, {
      ...emptyClient,
      name: "Maria Souza",
      email: "maria@example.com",
    });

    const result = await duplicateQuote(id, original);
    if (result.status !== "created") throw new Error("Cópia não criada.");
    const [copy] = await withUserDb(id, (tx) =>
      tx.select().from(quotes).where(eq(quotes.id, result.id)),
    );
    expect(copy).toMatchObject({
      number: 2,
      status: "draft",
      version: 1,
      clientId: created.client.id,
      clientName: "Maria Souza",
      clientEmail: "maria@example.com",
      discountType: "amount",
      discountValue: 22000,
      subtotalCents: 272000,
      discountCents: 22000,
      totalCents: 250000,
      validUntil: defaultValidUntil(30),
      paymentTerms: "50% na entrada",
      deliveryTime: "15 dias úteis",
      notes: "Valores sem impostos.",
      internalNotes: null,
    });

    const items = await withUserDb(id, (tx) =>
      tx
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.quoteId, result.id))
        .orderBy(asc(quoteItems.position)),
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      position: 0,
      description: "Logo",
      catalogItemId: catalog.item.id,
      discountType: "percent",
      discountValue: 1000,
      lineTotalCents: 72000,
    });
    expect(items[1]).toMatchObject({ position: 1, description: "Site" });
    // Itens novos: o original continua com os dele.
    expect(items[0]?.id).not.toBe(logo.id);
    expect((await getQuoteForEditor(id, original))?.items).toHaveLength(2);
  });

  it("duplica um orçamento respondido, e a cópia nasce rascunho e editável", async () => {
    const quoteId = await sentQuote(userA);
    await owner`update public.quotes set status = 'approved' where id = ${quoteId}`;
    const result = await duplicateQuote(userA, quoteId);
    if (result.status !== "created") throw new Error("Cópia não criada.");
    expect((await getQuoteForEditor(userA, result.id))?.status).toBe("draft");
    expect((await saveQuoteItems(userA, result.id, { items: [] })).status).toBe("saved");
  });

  it("conta no limite do mês (P3)", async () => {
    const id = await createAccount();
    const quoteId = await newQuote(id);
    const [{ month } = { month: "" }] = await owner<{ month: string }[]>`
      select to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as month`;
    await owner`update public.profiles set quotes_month = ${month}, quotes_month_count = 200 where id = ${id}`;
    expect(await duplicateQuote(id, quoteId)).toEqual({ status: "limit" });
  });

  it("orçamento de outra conta (ou id inválido) não existe", async () => {
    const quoteId = await newQuote(userA);
    expect(await duplicateQuote(userB, quoteId)).toEqual({ status: "not_found" });
    expect(await duplicateQuote(userA, "1 or 1=1")).toEqual({ status: "not_found" });
  });
});

describe("deleteQuote (RN-29)", () => {
  it("exclui em qualquer status, com os itens; o número não volta", async () => {
    const id = await createAccount();
    const draft = await newQuote(id);
    const approved = await sentQuote(id);
    await owner`update public.quotes set status = 'approved' where id = ${approved}`;

    expect(await deleteQuote(id, draft)).toBe(true);
    // A trava do respondido não barra a exclusão (os itens vão em cascata).
    expect(await deleteQuote(id, approved)).toBe(true);
    const [left] = await owner<{ total: number }[]>`
      select count(*)::int as total from public.quote_items where quote_id = ${approved}`;
    expect(left?.total).toBe(0);
    expect((await listQuotes(id, { tab: "todos", search: "" })).quotes).toEqual([]);

    const next = await newQuote(id);
    expect((await getQuoteForEditor(id, next))?.number).toBe(3);
  });

  it("não exclui o de outra conta nem um id inválido", async () => {
    const quoteId = await newQuote(userA);
    expect(await deleteQuote(userB, quoteId)).toBe(false);
    expect(await deleteQuote(userA, "x")).toBe(false);
    expect(await getQuoteForEditor(userA, quoteId)).not.toBeNull();
  });
});

describe("prorrogar a validade (RN-27, P5-A, P6-A)", () => {
  it("a nova validade, salva pelo editor, devolve o expirado a enviado e sobe a versão", async () => {
    const quoteId = await sentQuote(userA);
    await owner`update public.quotes set valid_until = current_date - 3 where id = ${quoteId}`;
    expect(
      (await listQuotes(userA, { tab: "expirados", search: "" })).quotes.map((quote) => quote.id),
    ).toContain(quoteId);

    const editor = await getQuoteForEditor(userA, quoteId);
    if (!editor) throw new Error("Orçamento não encontrado.");
    expect(editor.defaultValidityDays).toBe(15);
    const [before] = await withUserDb(userA, (tx) =>
      tx.select({ version: quotes.version }).from(quotes).where(eq(quotes.id, quoteId)),
    );

    const validUntil = addDays(todayInAppTimeZone(), 15);
    const result = await saveQuoteItems(userA, quoteId, {
      items: [item("Logo", "800")],
      options: options({ discount: { type: null, value: "" }, validUntil }),
    });
    expect(result.status).toBe("saved");

    const [after] = await withUserDb(userA, (tx) =>
      tx.select().from(quotes).where(eq(quotes.id, quoteId)),
    );
    expect(after).toMatchObject({ status: "sent", validUntil });
    expect(after?.version).toBe((before?.version ?? 0) + 1);
    expect(
      (await listQuotes(userA, { tab: "enviados", search: "" })).quotes.map((quote) => quote.id),
    ).toContain(quoteId);
  });
});
