import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteCatalogItem } from "@/features/catalog/catalog";
import { saveClient } from "@/features/clients/clients";
import {
  createClientForQuote,
  createQuote,
  getQuoteForEditor,
  ITEM_LIMIT_MESSAGE,
  LOCKED_MESSAGE,
  saveItemToCatalog,
  saveQuoteItems,
  setQuoteClient,
} from "@/features/quotes/quotes";
import { updateProfileField } from "@/features/profile/profile";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { quoteItems, quotes, user } from "@/lib/db/schema";
import { defaultValidUntil } from "@/lib/dates";

// O "miolo" do editor (F-05, NBB-86/87) contra o Postgres real: criação com os padrões do perfil,
// salvamento do orçamento inteiro (inserir, atualizar, apagar e reordenar numa transação), total
// recalculado no servidor, os limites traduzidos em mensagem, o cliente com a cópia dos dados (RN-20)
// e o catálogo (C6-A, C7-B).

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

async function newQuote(userId: string): Promise<string> {
  const result = await createQuote(userId);
  if (result.status !== "created") throw new Error("Orçamento não criado.");
  return result.id;
}

const item = (description: string, quantity = "1", unitPrice = "") => ({
  id: randomUUID(),
  description,
  quantity,
  unit: "",
  unitPrice,
  catalogItemId: null as string | null,
});

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

describe("createQuote", () => {
  it("nasce rascunho com os padrões do perfil (Q9-A, RN-19, RN-44)", async () => {
    const id = await createAccount();
    await updateProfileField(id, "defaultValidityDays", "30");
    await updateProfileField(id, "defaultNotes", "Valores sem impostos.");
    await updateProfileField(id, "defaultPaymentTerms", "50% na entrada");
    await updateProfileField(id, "defaultDeliveryTime", "15 dias úteis");

    const quoteId = await newQuote(id);
    const [created] = await withUserDb(id, (tx) =>
      tx.select().from(quotes).where(eq(quotes.id, quoteId)),
    );
    expect(created).toMatchObject({
      number: 1,
      status: "draft",
      validUntil: defaultValidUntil(30),
      notes: "Valores sem impostos.",
      paymentTerms: "50% na entrada",
      deliveryTime: "15 dias úteis",
    });
  });

  it("no limite do mês, avisa em vez de criar (RN-38)", async () => {
    const id = await createAccount();
    const [{ month } = { month: "" }] = await owner<{ month: string }[]>`
      select to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as month`;
    await owner`update public.profiles set quotes_month = ${month}, quotes_month_count = 200 where id = ${id}`;
    expect(await createQuote(id)).toEqual({ status: "limit" });
  });
});

describe("saveQuoteItems", () => {
  it("insere, atualiza, apaga e reordena, e o servidor recalcula o total", async () => {
    const quoteId = await newQuote(userA);
    const logo = item("Logo", "1", "800");
    const site = item("Site", "1", "2.000");
    const extra = item("Extra", "2", "10");

    expect(await saveQuoteItems(userA, quoteId, { items: [logo, site, extra] })).toEqual({
      status: "saved",
      totalCents: 282000,
    });

    // Tira o "Extra", muda o preço do site e coloca o site antes do logo (R1-A).
    expect(
      await saveQuoteItems(userA, quoteId, { items: [{ ...site, unitPrice: "1.500" }, logo] }),
    ).toEqual({ status: "saved", totalCents: 230000 });

    const quote = await getQuoteForEditor(userA, quoteId);
    expect(quote?.items).toEqual([
      {
        id: site.id,
        description: "Site",
        quantityMilli: 1000,
        unit: null,
        unitPriceCents: 150000,
        catalogItemId: null,
      },
      {
        id: logo.id,
        description: "Logo",
        quantityMilli: 1000,
        unit: null,
        unitPriceCents: 80000,
        catalogItemId: null,
      },
    ]);
    const [saved] = await withUserDb(userA, (tx) =>
      tx.select().from(quotes).where(eq(quotes.id, quoteId)),
    );
    expect(saved).toMatchObject({ subtotalCents: 230000, totalCents: 230000 });

    // Todos os itens removidos.
    expect(await saveQuoteItems(userA, quoteId, { items: [] })).toEqual({
      status: "saved",
      totalCents: 0,
    });
    expect((await getQuoteForEditor(userA, quoteId))?.items).toEqual([]);
  });

  it("guarda a quantidade com decimais e a linha calculada (RN-15)", async () => {
    const quoteId = await newQuote(userA);
    const hours = item("Horas", "1,5", "99,99");
    await saveQuoteItems(userA, quoteId, { items: [hours] });
    const [row] = await withUserDb(userA, (tx) =>
      tx.select().from(quoteItems).where(eq(quoteItems.id, hours.id)),
    );
    expect(row).toMatchObject({ quantity: "1.500", grossCents: 14999, lineTotalCents: 14999 });
  });

  it("campo inválido: nada é salvo e os erros voltam por item (P3-A)", async () => {
    const quoteId = await newQuote(userA);
    const good = item("Logo", "1", "800");
    const bad = item("Site", "abc", "800");
    const result = await saveQuoteItems(userA, quoteId, { items: [good, bad] });
    expect(result).toEqual({
      status: "invalid",
      errors: { [bad.id]: { quantity: "Informe uma quantidade válida, ex.: 1,5" } },
    });
    expect((await getQuoteForEditor(userA, quoteId))?.items).toEqual([]);
    expect(await saveQuoteItems(userA, quoteId, { items: "x" })).toEqual({
      status: "invalid",
      errors: {},
    });
  });

  it("orçamento de outra conta (ou id inválido) não existe para quem salva", async () => {
    const quoteId = await newQuote(userA);
    expect(await saveQuoteItems(userB, quoteId, { items: [item("x")] })).toEqual({
      status: "not_found",
    });
    expect(await getQuoteForEditor(userB, quoteId)).toBeNull();
    expect(await getQuoteForEditor(userA, "1 or 1=1")).toBeNull();
    expect(await saveQuoteItems(userA, "1 or 1=1", { items: [] })).toEqual({ status: "not_found" });
  });

  it("salva até 100 itens; mais que isso não passa (RN-14)", async () => {
    const quoteId = await newQuote(userA);
    const many = Array.from({ length: 100 }, (_, index) => item(`Item ${index}`));
    expect((await saveQuoteItems(userA, quoteId, { items: many })).status).toBe("saved");
    expect(
      (await saveQuoteItems(userA, quoteId, { items: [...many, item("Mais um")] })).status,
    ).toBe("invalid");
    expect(ITEM_LIMIT_MESSAGE).toBe("Este orçamento chegou ao limite de 100 itens.");
  });

  it("orçamento respondido não muda (RN-25)", async () => {
    const quoteId = await newQuote(userA);
    await saveQuoteItems(userA, quoteId, { items: [item("Logo", "1", "800")] });
    await withUserDb(userA, (tx) =>
      tx.update(quotes).set({ status: "sent" }).where(eq(quotes.id, quoteId)),
    );
    await owner`update public.quotes set status = 'approved' where id = ${quoteId}`;
    expect(await saveQuoteItems(userA, quoteId, { items: [] })).toEqual({
      status: "locked",
      message: LOCKED_MESSAGE,
    });
  });
});

describe("cliente no orçamento (NBB-87)", () => {
  const emptyClient = { email: "", phone: "", document: "", address: "", internalNotes: "" };

  it("escolher guarda uma cópia; mudar o cliente depois não muda o orçamento (RN-20)", async () => {
    const created = await saveClient(userA, null, {
      ...emptyClient,
      name: "Maria Silva",
      email: "maria@example.com",
      document: "529.982.247-25",
    });
    if (created.status !== "saved") throw new Error("Cliente não criado.");
    const quoteId = await newQuote(userA);

    expect(await setQuoteClient(userA, quoteId, created.client.id)).toMatchObject({
      status: "saved",
      client: { id: created.client.id, name: "Maria Silva", document: "52998224725" },
    });

    await saveClient(userA, created.client.id, { ...emptyClient, name: "Maria Souza" });
    expect((await getQuoteForEditor(userA, quoteId))?.client).toMatchObject({
      name: "Maria Silva",
      email: "maria@example.com",
    });

    // Tirar o cliente.
    expect(await setQuoteClient(userA, quoteId, null)).toEqual({ status: "saved", client: null });
    expect((await getQuoteForEditor(userA, quoteId))?.client).toBeNull();
  });

  it("criar pelo editor cria só com o nome e já escolhe (C4-A, RF-12)", async () => {
    const quoteId = await newQuote(userA);
    const result = await createClientForQuote(userA, quoteId, "  Fulano  ");
    expect(result).toMatchObject({ status: "saved", client: { name: "Fulano", email: null } });
    expect(await createClientForQuote(userA, quoteId, "")).toEqual({
      status: "invalid",
      message: "Informe o nome do cliente.",
    });
  });

  it("não escolhe cliente de outra conta", async () => {
    const otherClient = await saveClient(userB, null, { ...emptyClient, name: "Do B" });
    if (otherClient.status !== "saved") throw new Error("Cliente não criado.");
    const quoteId = await newQuote(userA);
    expect(await setQuoteClient(userA, quoteId, otherClient.client.id)).toEqual({
      status: "not_found",
    });
    expect(await setQuoteClient(userB, quoteId, otherClient.client.id)).toEqual({
      status: "not_found",
    });
  });
});

describe("catálogo no orçamento (NBB-87)", () => {
  it("salvar no catálogo cria o item, e o orçamento guarda a origem com a unidade (C7-B)", async () => {
    const saved = await saveItemToCatalog(userA, {
      description: "Criação de logo",
      unit: "un",
      unitPrice: "800",
    });
    if (saved.status !== "saved") throw new Error("Item não salvo no catálogo.");
    expect(saved.item).toMatchObject({
      name: "Criação de logo",
      unit: "un",
      unitPriceCents: 80000,
    });

    const quoteId = await newQuote(userA);
    const line = {
      ...item("Criação de logo", "1", "800"),
      unit: "un",
      catalogItemId: saved.item.id,
    };
    await saveQuoteItems(userA, quoteId, { items: [line] });
    expect((await getQuoteForEditor(userA, quoteId))?.items[0]).toMatchObject({
      unit: "un",
      catalogItemId: saved.item.id,
    });

    // Item do catálogo excluído enquanto o editor estava aberto: o item fica, só sem a origem.
    await deleteCatalogItem(userA, saved.item.id);
    expect((await saveQuoteItems(userA, quoteId, { items: [line] })).status).toBe("saved");
    expect((await getQuoteForEditor(userA, quoteId))?.items[0]?.catalogItemId).toBeNull();
  });

  it("sem descrição ou com valor inválido, não salva no catálogo", async () => {
    expect(await saveItemToCatalog(userA, { description: " ", unit: "", unitPrice: "" })).toEqual({
      status: "invalid",
      message: "Preencha a descrição para salvar no catálogo.",
    });
    expect(
      await saveItemToCatalog(userA, { description: "Logo", unit: "", unitPrice: "abc" }),
    ).toEqual({ status: "invalid", message: "Informe um preço válido, ex.: 1.234,56" });
  });
});
