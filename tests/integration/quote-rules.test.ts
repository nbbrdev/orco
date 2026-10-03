import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { quoteItems, quotes, user } from "@/lib/db/schema";

// Regras dos orçamentos no banco (NBB-46, PR 2): transições de status e envio (RN-13, RN-22 a RN-27),
// versão uma vez por transação (RN-24), trava do respondido (RN-25) e limites (RN-14, RN-38).
// A dona (orco_owner) faz o papel das funções públicas da M6, que aprovam e recusam.

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

async function createQuote(userId: string) {
  const [created] = await withUserDb(userId, (tx) =>
    tx.insert(quotes).values({ userId, validUntil: "2026-12-31" }).returning(),
  );
  if (!created) throw new Error("Orçamento não criado.");
  return created;
}

async function addItem(
  userId: string,
  quoteId: string,
  values: Partial<typeof quoteItems.$inferInsert> = {},
) {
  const [created] = await withUserDb(userId, (tx) =>
    tx
      .insert(quoteItems)
      .values({
        userId,
        quoteId,
        position: 0,
        description: "Logo",
        unitPriceCents: 80000,
        grossCents: 80000,
        lineTotalCents: 80000,
        ...values,
      })
      .returning(),
  );
  if (!created) throw new Error("Item não criado.");
  return created;
}

async function readQuote(userId: string, id: string) {
  const [row] = await withUserDb(userId, (tx) => tx.select().from(quotes).where(eq(quotes.id, id)));
  if (!row) throw new Error("Orçamento não encontrado.");
  return row;
}

async function send(userId: string, id: string) {
  await withUserDb(userId, (tx) =>
    tx.update(quotes).set({ status: "sent" }).where(eq(quotes.id, id)),
  );
}

/** Um orçamento já enviado, com 1 item completo. */
async function sentQuote(userId: string) {
  const quote = await createQuote(userId);
  await addItem(userId, quote.id);
  await send(userId, quote.id);
  return readQuote(userId, quote.id);
}

/** O que a M6 fará pela página do cliente: aprovar ou recusar (só a dona pode). */
async function respondAsOwner(id: string, status: "approved" | "rejected") {
  await owner`update public.quotes set status = ${status} where id = ${id}`;
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

describe("envio e status (RN-13, RN-22 a RN-27, Q3-A)", () => {
  it("só envia com ao menos 1 item, todos com descrição e valor", async () => {
    const quote = await createQuote(userA);
    expect(await postgresErrorOf(send(userA, quote.id))).toMatch(/ao menos 1 item/);

    const item = await addItem(userA, quote.id, { unitPriceCents: null });
    expect(await postgresErrorOf(send(userA, quote.id))).toMatch(/ao menos 1 item/);

    await withUserDb(userA, (tx) =>
      tx
        .update(quoteItems)
        .set({ unitPriceCents: 0, description: "  " })
        .where(eq(quoteItems.id, item.id)),
    );
    expect(await postgresErrorOf(send(userA, quote.id))).toMatch(/ao menos 1 item/);

    await withUserDb(userA, (tx) =>
      tx.update(quoteItems).set({ description: "Logo" }).where(eq(quoteItems.id, item.id)),
    );
    await send(userA, quote.id);
    const sent = await readQuote(userA, quote.id);
    expect(sent).toMatchObject({ status: "sent", version: 1 });
    expect(sent.sentAt).toBeInstanceOf(Date);
  });

  it("o app não aprova, não recusa, nem volta para rascunho", async () => {
    const quote = await sentQuote(userA);
    for (const status of ["approved", "rejected", "draft"] as const) {
      expect(
        await postgresErrorOf(
          withUserDb(userA, (tx) =>
            tx.update(quotes).set({ status }).where(eq(quotes.id, quote.id)),
          ),
        ),
      ).toMatch(/Mudança de status não permitida/);
    }

    const draft = await createQuote(userA);
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) =>
          tx.update(quotes).set({ status: "approved" }).where(eq(quotes.id, draft.id)),
        ),
      ),
    ).toMatch(/Mudança de status não permitida/);
  });

  it("a M6 (dona) aprova um enviado e o banco marca a resposta", async () => {
    const quote = await sentQuote(userA);
    await respondAsOwner(quote.id, "approved");
    const approved = await readQuote(userA, quote.id);
    expect(approved.status).toBe("approved");
    expect(approved.respondedAt).toBeInstanceOf(Date);
  });

  it("prorrogar a validade libera um novo lembrete (RN-43)", async () => {
    const quote = await sentQuote(userA);
    await owner`update public.quotes set reminder_sent_at = now() where id = ${quote.id}`;
    await withUserDb(userA, (tx) =>
      tx.update(quotes).set({ validUntil: "2027-01-31" }).where(eq(quotes.id, quote.id)),
    );
    expect((await readQuote(userA, quote.id)).reminderSentAt).toBeNull();
  });
});

describe("versão (RN-24, Q4-A)", () => {
  it("rascunho não versiona; enviado sobe a cada edição salva", async () => {
    const draft = await createQuote(userA);
    await withUserDb(userA, (tx) =>
      tx.update(quotes).set({ notes: "rascunho" }).where(eq(quotes.id, draft.id)),
    );
    expect((await readQuote(userA, draft.id)).version).toBe(1);

    const quote = await sentQuote(userA);
    await withUserDb(userA, (tx) =>
      tx.update(quotes).set({ notes: "edição 1" }).where(eq(quotes.id, quote.id)),
    );
    await withUserDb(userA, (tx) =>
      tx.update(quotes).set({ notes: "edição 2" }).where(eq(quotes.id, quote.id)),
    );
    expect((await readQuote(userA, quote.id)).version).toBe(3);
  });

  it("um salvamento (transação) com itens e totais conta como uma versão só", async () => {
    const quote = await sentQuote(userA);
    const [item] = await withUserDb(userA, (tx) =>
      tx.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)),
    );
    await withUserDb(userA, async (tx) => {
      await tx
        .update(quoteItems)
        .set({ description: "Logo novo" })
        .where(eq(quoteItems.id, item?.id ?? ""));
      await tx.insert(quoteItems).values({
        userId: userA,
        quoteId: quote.id,
        position: 1,
        description: "Site",
        unitPriceCents: 1000,
        grossCents: 1000,
        lineTotalCents: 1000,
      });
      await tx
        .update(quotes)
        .set({ subtotalCents: 81000, totalCents: 81000 })
        .where(eq(quotes.id, quote.id));
    });
    expect((await readQuote(userA, quote.id)).version).toBe(2);
  });

  it("só mexer num item também versiona; anotações internas não (RN-20a)", async () => {
    const quote = await sentQuote(userA);
    await withUserDb(userA, (tx) =>
      tx
        .update(quoteItems)
        .set({ description: "Logo revisado" })
        .where(eq(quoteItems.quoteId, quote.id)),
    );
    expect((await readQuote(userA, quote.id)).version).toBe(2);

    await withUserDb(userA, (tx) =>
      tx.update(quotes).set({ internalNotes: "ligar sexta" }).where(eq(quotes.id, quote.id)),
    );
    expect((await readQuote(userA, quote.id)).version).toBe(2);
  });
});

describe("trava do respondido (RN-25, Q5-A)", () => {
  it("só as anotações internas e o 'visto' mudam; itens não", async () => {
    const quote = await sentQuote(userA);
    await respondAsOwner(quote.id, "rejected");

    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) =>
          tx.update(quotes).set({ notes: "mudou" }).where(eq(quotes.id, quote.id)),
        ),
      ),
    ).toMatch(/Orçamento respondido/);
    expect(await postgresErrorOf(addItem(userA, quote.id, { position: 1 }))).toMatch(
      /Orçamento respondido/,
    );
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) =>
          tx.update(quoteItems).set({ description: "x" }).where(eq(quoteItems.quoteId, quote.id)),
        ),
      ),
    ).toMatch(/Orçamento respondido/);
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) => tx.delete(quoteItems).where(eq(quoteItems.quoteId, quote.id))),
      ),
    ).toMatch(/Orçamento respondido/);

    await withUserDb(userA, (tx) =>
      tx
        .update(quotes)
        .set({ internalNotes: "perdemos no preço", responseSeenAt: new Date() })
        .where(eq(quotes.id, quote.id)),
    );
    const after = await readQuote(userA, quote.id);
    expect(after).toMatchObject({ internalNotes: "perdemos no preço", version: 1 });

    // A resposta é definitiva, nem a dona muda (RN-32).
    expect(await postgresErrorOf(respondAsOwner(quote.id, "approved"))).toMatch(
      /Orçamento respondido/,
    );
  });

  it("excluir o orçamento respondido continua permitido (RN-29)", async () => {
    const quote = await sentQuote(userA);
    await respondAsOwner(quote.id, "approved");
    await withUserDb(userA, (tx) => tx.delete(quotes).where(eq(quotes.id, quote.id)));
    expect(
      await withUserDb(userA, (tx) => tx.select().from(quotes).where(eq(quotes.id, quote.id))),
    ).toHaveLength(0);
  });

  it("a exclusão da conta apaga orçamentos aprovados (RN-06)", async () => {
    const id = await createAccount();
    const quote = await sentQuote(id);
    await respondAsOwner(quote.id, "approved");
    await getAuthDb().delete(user).where(eq(user.id, id));
    expect(await withUserDb(id, (tx) => tx.select().from(quoteItems))).toHaveLength(0);
  });
});

describe("limites (RN-14, RN-38)", () => {
  it("até 100 itens por orçamento (Q8-A)", async () => {
    const quote = await createQuote(userA);
    await withUserDb(userA, (tx) =>
      tx
        .insert(quoteItems)
        .values(
          Array.from({ length: 99 }, (_, position) => ({
            userId: userA,
            quoteId: quote.id,
            position,
          })),
        ),
    );
    // Dois itens ao mesmo tempo no 100º: só um passa.
    const results = await Promise.allSettled([
      addItem(userA, quote.id, { position: 99 }),
      addItem(userA, quote.id, { position: 100 }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await postgresErrorOf(addItem(userA, quote.id, { position: 101 }))).toMatch(
      /Limite de 100 itens/,
    );
  });

  it("200 orçamentos criados por mês; excluir não devolve a vaga (Q7-A)", async () => {
    const id = await createAccount();
    const [{ month } = { month: "" }] = await owner<{ month: string }[]>`
      select to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as month`;
    await owner`update public.profiles set quotes_month = ${month}, quotes_month_count = 199 where id = ${id}`;

    const last = await createQuote(id);
    expect(await postgresErrorOf(createQuote(id))).toMatch(/Limite de 200 orçamentos/);

    await withUserDb(id, (tx) => tx.delete(quotes).where(eq(quotes.id, last.id)));
    expect(await postgresErrorOf(createQuote(id))).toMatch(/Limite de 200 orçamentos/);

    // O número recusado não foi gasto: a numeração continua de onde estava.
    const [profile] = await owner<{ next: number }[]>`
      select next_quote_number as next from public.profiles where id = ${id}`;
    expect(profile?.next).toBe(last.number + 1);
  });

  it("o contador recomeça no mês seguinte", async () => {
    const id = await createAccount();
    await owner`update public.profiles set quotes_month = '2000-01-01', quotes_month_count = 200 where id = ${id}`;
    await createQuote(id);
    const [profile] = await owner<{ count: number }[]>`
      select quotes_month_count as count from public.profiles where id = ${id}`;
    expect(profile?.count).toBe(1);
  });

  it("a app_user não mexe no contador do mês", async () => {
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) =>
          tx.execute(sql`update profiles set quotes_month_count = 0 where id = ${userA}`),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});
