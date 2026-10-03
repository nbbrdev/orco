import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveCatalogItem } from "@/features/catalog/catalog";
import { saveClient } from "@/features/clients/clients";
import {
  countCatalogItemDrafts,
  countClientDrafts,
  createQuote,
  getQuoteForEditor,
  listClientQuotes,
  saveQuoteItems,
  updateCatalogItemDrafts,
  updateClientDrafts,
} from "@/features/quotes/quotes";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { quoteItems, quotes, user } from "@/lib/db/schema";

// Orçamentos a partir do cliente e do catálogo (NBB-87, PR 2) contra o Postgres real: a lista do
// cliente (RF-13), o "Novo orçamento para este cliente" e a atualização dos rascunhos quando o cliente
// (RN-20) ou o item do catálogo (RN-11) mudam. Enviados nunca mudam.

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

async function newClient(userId: string, name: string, extra: Partial<typeof emptyClient> = {}) {
  const created = await saveClient(userId, null, { ...emptyClient, ...extra, name });
  if (created.status !== "saved") throw new Error("Cliente não criado.");
  return created.client.id;
}

async function newQuote(userId: string, clientId: string | null = null): Promise<string> {
  const result = await createQuote(userId, clientId);
  if (result.status !== "created") throw new Error("Orçamento não criado.");
  return result.id;
}

/** Envia o orçamento (precisa de um item completo, RN-13). */
async function send(userId: string, quoteId: string) {
  await saveQuoteItems(userId, quoteId, {
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
  await withUserDb(userId, (tx) =>
    tx.update(quotes).set({ status: "sent" }).where(eq(quotes.id, quoteId)),
  );
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

describe("orçamentos do cliente (RF-13, D1-A, D2-A)", () => {
  it("o novo orçamento já nasce com a cópia do cliente", async () => {
    const clientId = await newClient(userA, "Ana Lima", { email: "ana@example.com" });
    const quoteId = await newQuote(userA, clientId);
    expect((await getQuoteForEditor(userA, quoteId))?.client).toMatchObject({
      id: clientId,
      name: "Ana Lima",
      email: "ana@example.com",
    });
    // Cliente que não existe: nasce sem cliente.
    const orphan = await newQuote(userA, randomUUID());
    expect((await getQuoteForEditor(userA, orphan))?.client).toBeNull();
  });

  it("lista do mais novo ao mais antigo, com o status como a pessoa vê", async () => {
    const clientId = await newClient(userA, "Bruno");
    const first = await newQuote(userA, clientId);
    const second = await newQuote(userA, clientId);
    await send(userA, first);
    await owner`update public.quotes set valid_until = '2020-01-01' where id = ${first}`;

    const listed = await listClientQuotes(userA, clientId);
    expect(listed.map((quote) => quote.id)).toEqual([second, first]);
    expect(listed.map((quote) => quote.status)).toEqual(["draft", "expired"]);
    expect(listed[1]?.totalCents).toBe(80000);
    expect(await listClientQuotes(userA, "x")).toEqual([]);
  });
});

describe("rascunhos do cliente (RN-20, D3-A)", () => {
  it("conta e atualiza só os rascunhos; o enviado fica como estava", async () => {
    const clientId = await newClient(userA, "Carla", { phone: "11912345678" });
    const draft = await newQuote(userA, clientId);
    const sent = await newQuote(userA, clientId);
    await send(userA, sent);

    expect(await countClientDrafts(userA, clientId)).toBe(1);
    await saveClient(userA, clientId, { ...emptyClient, name: "Carla Souza", phone: "1133334444" });
    expect(await updateClientDrafts(userA, clientId)).toBe(1);

    expect((await getQuoteForEditor(userA, draft))?.client).toMatchObject({
      name: "Carla Souza",
      phone: "(11) 3333-4444",
    });
    expect((await getQuoteForEditor(userA, sent))?.client?.name).toBe("Carla");
    expect(await countClientDrafts(userA, "x")).toBe(0);
    expect(await updateClientDrafts(userA, randomUUID())).toBe(0);
  });
});

describe("rascunhos do item do catálogo (RN-11, D4-A)", () => {
  it("troca descrição, unidade e valor, mantém a quantidade e recalcula os totais", async () => {
    const saved = await saveCatalogItem(userA, null, { name: "Hora", unit: "h", unitPrice: "100" });
    if (saved.status !== "saved") throw new Error("Item não criado.");
    const itemId = saved.item.id;

    const line = (quantity: string) => ({
      id: randomUUID(),
      description: "Hora",
      quantity,
      unit: "h",
      unitPrice: "100",
      catalogItemId: itemId,
    });
    const other = {
      id: randomUUID(),
      description: "Extra",
      quantity: "1",
      unit: "",
      unitPrice: "50",
      catalogItemId: null,
    };
    const draft = await newQuote(userA);
    await saveQuoteItems(userA, draft, { items: [line("1,5"), other] });
    const sent = await newQuote(userA);
    await saveQuoteItems(userA, sent, { items: [line("2")] });
    await withUserDb(userA, (tx) =>
      tx.update(quotes).set({ status: "sent" }).where(eq(quotes.id, sent)),
    );

    expect(await countCatalogItemDrafts(userA, itemId)).toBe(1);
    await saveCatalogItem(userA, itemId, { name: "Hora técnica", unit: "hr", unitPrice: "120" });
    expect(await updateCatalogItemDrafts(userA, itemId)).toBe(1);

    const updated = await getQuoteForEditor(userA, draft);
    expect(updated?.items[0]).toMatchObject({
      description: "Hora técnica",
      unit: "hr",
      unitPriceCents: 12000,
      quantityMilli: 1500,
    });
    const [totals] = await withUserDb(userA, (tx) =>
      tx.select().from(quotes).where(eq(quotes.id, draft)),
    );
    // 1,5 × 120,00 + 50,00 = 230,00.
    expect(totals?.totalCents).toBe(23000);

    // O enviado não muda.
    expect((await getQuoteForEditor(userA, sent))?.items[0]?.description).toBe("Hora");
    expect(await countCatalogItemDrafts(userA, "x")).toBe(0);
    expect(await updateCatalogItemDrafts(userA, randomUUID())).toBe(0);
  });

  it("mantém os descontos do item e o geral ao recalcular (NBB-88)", async () => {
    const saved = await saveCatalogItem(userA, null, { name: "Logo", unit: "", unitPrice: "800" });
    if (saved.status !== "saved") throw new Error("Item não criado.");
    const itemId = saved.item.id;

    const draft = await newQuote(userA);
    const line = {
      id: randomUUID(),
      description: "Logo",
      quantity: "1",
      unit: "",
      unitPrice: "800",
      catalogItemId: itemId,
      discount: { type: "percent", value: "10" },
    };
    await saveQuoteItems(userA, draft, {
      items: [line],
      options: {
        discount: { type: "amount", value: "100" },
        validUntil: "2026-12-31",
        paymentTerms: "",
        deliveryTime: "",
        notes: "",
        internalNotes: "",
      },
    });

    await saveCatalogItem(userA, itemId, { name: "Logo", unit: "", unitPrice: "1.000" });
    expect(await updateCatalogItemDrafts(userA, itemId)).toBe(1);

    const [row] = await withUserDb(userA, (tx) =>
      tx.select().from(quoteItems).where(eq(quoteItems.id, line.id)),
    );
    expect(row).toMatchObject({ grossCents: 100000, discountCents: 10000, lineTotalCents: 90000 });
    const [totals] = await withUserDb(userA, (tx) =>
      tx.select().from(quotes).where(eq(quotes.id, draft)),
    );
    // 1.000,00 − 10% = 900,00; menos 100,00 de desconto geral = 800,00.
    expect(totals).toMatchObject({ subtotalCents: 90000, discountCents: 10000, totalCents: 80000 });
  });
});
