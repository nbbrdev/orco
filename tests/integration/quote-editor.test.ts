import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createQuote,
  getQuoteForEditor,
  ITEM_LIMIT_MESSAGE,
  LOCKED_MESSAGE,
  saveQuoteItems,
} from "@/features/quotes/quotes";
import { updateProfileField } from "@/features/profile/profile";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { quoteItems, quotes, user } from "@/lib/db/schema";
import { defaultValidUntil } from "@/lib/dates";

// O "miolo" do editor (F-05, NBB-86) contra o Postgres real: criação com os padrões do perfil,
// salvamento do orçamento inteiro (inserir, atualizar, apagar e reordenar numa transação), total
// recalculado no servidor e os limites traduzidos em mensagem.

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
  unitPrice,
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
      { id: site.id, description: "Site", quantityMilli: 1000, unitPriceCents: 150000 },
      { id: logo.id, description: "Logo", quantityMilli: 1000, unitPriceCents: 80000 },
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
