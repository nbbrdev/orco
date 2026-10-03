import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteClient } from "@/features/clients/clients";
import { closeDb, getAppDb, getAuthDb, withUserDb } from "@/lib/db";
import { catalogItems, clients, quoteItems, quotes, user } from "@/lib/db/schema";

// Orçamentos e itens (NBB-46, PR 1) contra o Postgres real: numeração por conta (RN-12), valores
// iniciais e token (RN-30) garantidos pelo banco, RLS, permissões por coluna, FKs compostas (nada
// aponta para dados de outra conta) e a FK do cliente que impede excluí-lo com orçamentos (RN-09).

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

// O Drizzle embrulha o erro do Postgres ("Failed query: …"); a mensagem real fica em `cause`.
async function postgresErrorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return cause instanceof Error ? cause.message : String(cause);
  }
  return "(nenhum erro)";
}

async function createQuote(userId: string, values: Partial<typeof quotes.$inferInsert> = {}) {
  const [created] = await withUserDb(userId, (tx) =>
    tx
      .insert(quotes)
      .values({ userId, validUntil: "2026-12-31", ...values })
      .returning(),
  );
  if (!created) throw new Error("Orçamento não criado.");
  return created;
}

async function createClient(userId: string, name = "Cliente") {
  const [created] = await withUserDb(userId, (tx) =>
    tx.insert(clients).values({ userId, name }).returning({ id: clients.id }),
  );
  return created?.id ?? "";
}

let userA = "";
let userB = "";

beforeAll(async () => {
  userA = await createAccount();
  userB = await createAccount();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await closeDb();
});

describe("quotes: criação", () => {
  it("numera por conta, a partir de 1, e nasce rascunho na versão 1 com token (RN-12, RN-30)", async () => {
    const id = await createAccount();
    const first = await createQuote(id);
    const second = await createQuote(id);
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first).toMatchObject({ status: "draft", version: 1, viewCount: 0 });
    expect(first.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.publicToken).not.toBe(second.publicToken);

    // A numeração de outra conta é independente.
    expect((await createQuote(userB)).number).toBeGreaterThanOrEqual(1);
  });

  it("ignora número, status, versão, token e datas da M6 mandados pelo app", async () => {
    const id = await createAccount();
    const created = await createQuote(id, {
      number: 999,
      status: "approved",
      version: 7,
      publicToken: "a".repeat(43),
      respondedAt: new Date(),
      viewCount: 5,
    });
    expect(created).toMatchObject({
      number: 1,
      status: "draft",
      version: 1,
      respondedAt: null,
      viewCount: 0,
    });
    expect(created.publicToken).not.toBe("a".repeat(43));
  });

  it("orçamentos criados ao mesmo tempo nunca repetem o número (Q2-A)", async () => {
    const id = await createAccount();
    const created = await Promise.all(Array.from({ length: 5 }, () => createQuote(id)));
    expect(created.map((quote) => quote.number).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("não cria orçamento em nome de outra conta", async () => {
    expect(
      await postgresErrorOf(
        withUserDb(userB, (tx) =>
          tx.insert(quotes).values({ userId: userA, validUntil: "2026-12-31" }),
        ),
      ),
    ).toMatch(/conta da transação/);
  });
});

describe("quotes: acesso", () => {
  it("cada conta só vê, altera e exclui os próprios orçamentos e itens", async () => {
    const quote = await createQuote(userA);
    await withUserDb(userA, (tx) =>
      tx.insert(quoteItems).values({ userId: userA, quoteId: quote.id, position: 0 }),
    );

    expect(
      await withUserDb(userB, (tx) => tx.select().from(quotes).where(eq(quotes.id, quote.id))),
    ).toHaveLength(0);
    expect(
      await withUserDb(userB, (tx) =>
        tx.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)),
      ),
    ).toHaveLength(0);
    const updated = await withUserDb(userB, (tx) =>
      tx.update(quotes).set({ notes: "invadido" }).where(eq(quotes.id, quote.id)).returning(),
    );
    expect(updated).toHaveLength(0);
    expect(await getAppDb().select().from(quotes)).toHaveLength(0);
  });

  it("nada aponta para dados de outra conta (FKs compostas)", async () => {
    const quoteOfA = await createQuote(userA);
    const clientOfA = await createClient(userA);
    const [itemOfA] = await withUserDb(userA, (tx) =>
      tx.insert(catalogItems).values({ userId: userA, name: "Item do A" }).returning(),
    );

    // Orçamento de B com o cliente de A.
    expect(await postgresErrorOf(createQuote(userB, { clientId: clientOfA }))).toMatch(
      /quotes_client_id_user_id_fk/,
    );
    // Item de B no orçamento de A.
    expect(
      await postgresErrorOf(
        withUserDb(userB, (tx) =>
          tx.insert(quoteItems).values({ userId: userB, quoteId: quoteOfA.id, position: 0 }),
        ),
      ),
    ).toMatch(/quote_items_quote_id_user_id_fk/);
    // Item de B apontando para o catálogo de A.
    const quoteOfB = await createQuote(userB);
    expect(
      await postgresErrorOf(
        withUserDb(userB, (tx) =>
          tx.insert(quoteItems).values({
            userId: userB,
            quoteId: quoteOfB.id,
            position: 0,
            catalogItemId: itemOfA?.id,
          }),
        ),
      ),
    ).toMatch(/quote_items_catalog_item_id_user_id_fk/);
  });

  it("a app_user não muda número, token, versão, status, dono nem datas", async () => {
    const quote = await createQuote(userA);
    const attempts: Partial<typeof quotes.$inferInsert>[] = [
      { number: 50 },
      { publicToken: "b".repeat(43) },
      { version: 9 },
      { status: "approved" },
      { userId: userB },
      { respondedAt: new Date() },
      { viewCount: 3 },
    ];
    for (const values of attempts) {
      expect(
        await postgresErrorOf(
          withUserDb(userA, (tx) => tx.update(quotes).set(values).where(eq(quotes.id, quote.id))),
        ),
      ).toMatch(/permission denied/);
    }
  });
});

describe("quote_items", () => {
  it("excluir o orçamento apaga os itens", async () => {
    const quote = await createQuote(userA);
    await withUserDb(userA, (tx) =>
      tx.insert(quoteItems).values({ userId: userA, quoteId: quote.id, position: 0 }),
    );
    await withUserDb(userA, (tx) => tx.delete(quotes).where(eq(quotes.id, quote.id)));
    expect(
      await withUserDb(userA, (tx) =>
        tx.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)),
      ),
    ).toHaveLength(0);
  });

  it("excluir o item do catálogo mantém a linha e só solta a origem (RN-11)", async () => {
    const quote = await createQuote(userA);
    const [catalogItem] = await withUserDb(userA, (tx) =>
      tx.insert(catalogItems).values({ userId: userA, name: "Logo" }).returning(),
    );
    const [line] = await withUserDb(userA, (tx) =>
      tx
        .insert(quoteItems)
        .values({
          userId: userA,
          quoteId: quote.id,
          position: 0,
          catalogItemId: catalogItem?.id,
          description: "Logo",
          quantity: "1.5",
        })
        .returning(),
    );
    await withUserDb(userA, (tx) =>
      tx.delete(catalogItems).where(eq(catalogItems.id, catalogItem?.id ?? "")),
    );
    const [after] = await withUserDb(userA, (tx) =>
      tx
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.id, line?.id ?? "")),
    );
    expect(after).toMatchObject({
      catalogItemId: null,
      userId: userA,
      description: "Logo",
      quantity: "1.500",
    });
  });

  it("o banco recusa totais incoerentes, quantidade zero e desconto fora da faixa", async () => {
    const quote = await createQuote(userA);
    const invalid: Partial<typeof quoteItems.$inferInsert>[] = [
      { quantity: "0" },
      { grossCents: 1000, lineTotalCents: 900 },
      { discountType: "percent", discountValue: 10001 },
      { unitPriceCents: 1_000_000_000 },
    ];
    for (const values of invalid) {
      expect(
        await postgresErrorOf(
          withUserDb(userA, (tx) =>
            tx
              .insert(quoteItems)
              .values({ userId: userA, quoteId: quote.id, position: 0, ...values }),
          ),
        ),
      ).toMatch(/violates check constraint/);
    }
  });
});

describe("cliente com orçamentos (RN-09, Q11-A)", () => {
  it("não pode ser excluído; a mensagem diz quantos orçamentos ele tem", async () => {
    const clientId = await createClient(userA, "Com orçamento");
    const quote = await createQuote(userA, { clientId });

    expect(await deleteClient(userA, clientId)).toEqual({
      status: "has_quotes",
      message: "Este cliente tem 1 orçamento. Exclua-o antes de excluir o cliente.",
    });

    await createQuote(userA, { clientId });
    expect(await deleteClient(userA, clientId)).toMatchObject({
      message: "Este cliente tem 2 orçamentos. Exclua-os antes de excluir o cliente.",
    });

    await withUserDb(userA, (tx) => tx.delete(quotes).where(eq(quotes.clientId, clientId)));
    expect(quote.clientId).toBe(clientId);
    expect(await deleteClient(userA, clientId)).toEqual({ status: "deleted" });
  });

  it("a exclusão da conta apaga tudo, mesmo com clientes que têm orçamentos", async () => {
    const id = await createAccount();
    const clientId = await createClient(id);
    const quote = await createQuote(id, { clientId });
    await withUserDb(id, (tx) =>
      tx.insert(quoteItems).values({ userId: id, quoteId: quote.id, position: 0 }),
    );

    await getAuthDb().delete(user).where(eq(user.id, id));
    expect(await withUserDb(id, (tx) => tx.select().from(quotes))).toHaveLength(0);
    expect(await withUserDb(id, (tx) => tx.select().from(clients))).toHaveLength(0);
  });
});
