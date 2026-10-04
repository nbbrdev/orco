import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveClient } from "@/features/clients/clients";
import { updateProfileField } from "@/features/profile/profile";
import {
  getPublicQuote,
  isQuoteOwner,
  publicDocumentModel,
  PUBLIC_PDF_LIMIT_PER_MINUTE,
  registerQuoteView,
  renderPublicPdf,
} from "@/features/public-quote/public-quote";
import { deleteQuote } from "@/features/quotes/manage";
import { createQuote, saveQuoteItems, sendQuote } from "@/features/quotes/quotes";
import { closeDb, getAppDb, getAuthDb, withUserDb } from "@/lib/db";
import { quoteEvents, quotes, user } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

// O acesso público por token (NBB-52, PR 1) contra o Postgres real: a leitura só devolve o mínimo e
// trata rascunho, excluído e token inválido do mesmo jeito (RN-31); a visualização conta uma vez como
// evento (RN-35) sem mexer no updated_at; a app_user não lê o IP nem escreve eventos (D8-A); e o PDF
// público (D7).

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

const item = (description: string, unitPrice: string) => ({
  id: randomUUID(),
  description,
  quantity: "1,5",
  unit: "h",
  unitPrice,
  catalogItemId: null,
});

/** Um orçamento enviado, com o token (que o app só mostra na M6, NBB-54). */
async function sentQuote(userId: string, clientId: string | null = null) {
  const created = await createQuote(userId, clientId);
  if (created.status !== "created") throw new Error("Orçamento não criado.");
  await saveQuoteItems(userId, created.id, {
    items: [item("Logo", "800"), item("Site", "2.000")],
  });
  expect(await sendQuote(userId, created.id)).toBe("sent");
  return { id: created.id, token: await tokenOf(created.id) };
}

async function tokenOf(id: string): Promise<string> {
  const [row] = await owner<{ public_token: string }[]>`
    select public_token from public.quotes where id = ${id}`;
  return row?.public_token ?? "";
}

let account = "";

beforeAll(async () => {
  account = await createAccount();
  await updateProfileField(account, "businessName", "Estúdio Exemplo");
  await updateProfileField(account, "paymentInfo", "Pix: contato@example.com");
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("getPublicQuote (RN-31, D4-A)", () => {
  it("devolve só o que o cliente vê", async () => {
    const client = await saveClient(account, null, {
      name: "Maria Silva",
      email: "maria@example.com",
      phone: "",
      document: "",
      address: "",
      internalNotes: "Cliente difícil",
    });
    if (client.status !== "saved") throw new Error("Cliente não criado.");
    const { id, token } = await sentQuote(account, client.client.id);
    await withUserDb(account, (tx) =>
      tx.update(quotes).set({ internalNotes: "Só eu vejo" }).where(eq(quotes.id, id)),
    );

    const quote = await getPublicQuote(token);
    expect(quote).toMatchObject({
      number: expect.any(Number),
      status: "sent",
      version: 1,
      client: { name: "Maria Silva", email: "maria@example.com" },
      issuer: { businessName: "Estúdio Exemplo", paymentInfo: "Pix: contato@example.com" },
    });
    expect(quote?.sentAt).toBeInstanceOf(Date);
    expect(quote?.items.map((line) => [line.description, line.quantityMilli])).toEqual([
      ["Logo", 1500],
      ["Site", 1500],
    ]);

    // Nada de ids, dono, e-mail da conta, anotações internas, token ou contagem.
    const [raw] = await getAppDb().execute<{ quote: Record<string, unknown> }>(
      sql`select app.get_public_quote(${token}) as quote`,
    );
    const text = JSON.stringify(raw?.quote);
    expect(Object.keys(raw?.quote ?? {}).sort()).toEqual(
      [
        "client",
        "deliveryTime",
        "discountType",
        "discountValue",
        "issuer",
        "items",
        "notes",
        "number",
        "paymentTerms",
        "respondedAt",
        "sentAt",
        "status",
        "validUntil",
        "version",
      ].sort(),
    );
    for (const secret of [id, account, token, "Só eu vejo", "Cliente difícil", emails[0] ?? "x"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("rascunho, excluído e token inválido dão o mesmo nulo", async () => {
    const draft = await createQuote(account);
    if (draft.status !== "created") throw new Error("Orçamento não criado.");
    expect(await getPublicQuote(await tokenOf(draft.id))).toBeNull();

    const deleted = await sentQuote(account);
    await deleteQuote(account, deleted.id);
    expect(await getPublicQuote(deleted.token)).toBeNull();

    expect(await getPublicQuote("x")).toBeNull();
    expect(await getPublicQuote("A".repeat(43))).toBeNull();
  });

  it("aprovado e recusado continuam visíveis", async () => {
    const { id, token } = await sentQuote(account);
    await owner`update public.quotes set status = 'approved' where id = ${id}`;
    expect((await getPublicQuote(token))?.status).toBe("approved");
  });
});

describe("registerQuoteView (RN-35, D2-A)", () => {
  it("conta toda abertura, registra o evento só na primeira e não mexe no updated_at", async () => {
    const { id, token } = await sentQuote(account);
    const [before] = await owner<{ updated_at: Date; version: number }[]>`
      select updated_at, version from public.quotes where id = ${id}`;

    expect(await registerQuoteView(token, "200.150.10.7", "Mozilla/5.0 (Android)")).toBe(true);
    expect(await registerQuoteView(token, "200.150.10.8", "Mozilla/5.0 (iPhone)")).toBe(false);

    const [after] = await owner<
      { view_count: number; first_viewed_at: Date | null; updated_at: Date; version: number }[]
    >`select view_count, first_viewed_at, updated_at, version from public.quotes where id = ${id}`;
    expect(after?.view_count).toBe(2);
    expect(after?.first_viewed_at).toBeInstanceOf(Date);
    expect(after?.updated_at).toEqual(before?.updated_at);
    expect(after?.version).toBe(before?.version);

    const events = await owner<{ type: string; ip: string | null; user_agent: string }[]>`
      select type, host(ip) as ip, user_agent from public.quote_events where quote_id = ${id}`;
    expect(events).toEqual([
      { type: "viewed", ip: "200.150.10.7", user_agent: "Mozilla/5.0 (Android)" },
    ]);
  });

  it("IP que não é IP vira nulo; rascunho e token inválido não contam", async () => {
    const { id, token } = await sentQuote(account);
    expect(await registerQuoteView(token, "unknown", "a".repeat(600))).toBe(true);
    const [event] = await owner<{ ip: string | null; length: number }[]>`
      select ip, char_length(user_agent) as length from public.quote_events where quote_id = ${id}`;
    expect(event).toEqual({ ip: null, length: 500 });

    const draft = await createQuote(account);
    if (draft.status !== "created") throw new Error("Orçamento não criado.");
    expect(await registerQuoteView(await tokenOf(draft.id), "200.150.10.7", null)).toBe(false);
    expect(await registerQuoteView("x", "200.150.10.7", null)).toBe(false);
    const [row] = await owner<{ view_count: number }[]>`
      select view_count from public.quotes where id = ${draft.id}`;
    expect(row?.view_count).toBe(0);
  });
});

describe("quote_events para a app_user (D8-A)", () => {
  it("o dono lê os próprios eventos, sem o IP; outra conta não vê nada", async () => {
    const { id, token } = await sentQuote(account);
    await registerQuoteView(token, "200.150.10.7", "Mozilla/5.0");

    const events = await withUserDb(account, (tx) =>
      tx
        .select({ type: quoteEvents.type, userAgent: quoteEvents.userAgent })
        .from(quoteEvents)
        .where(eq(quoteEvents.quoteId, id)),
    );
    expect(events).toEqual([{ type: "viewed", userAgent: "Mozilla/5.0" }]);

    await expect(
      withUserDb(account, (tx) =>
        tx.select({ ip: quoteEvents.ip }).from(quoteEvents).where(eq(quoteEvents.quoteId, id)),
      ),
    ).rejects.toThrow();

    const other = await createAccount();
    expect(
      await withUserDb(other, (tx) =>
        tx.select({ id: quoteEvents.id }).from(quoteEvents).where(eq(quoteEvents.quoteId, id)),
      ),
    ).toEqual([]);
  });

  it("a app_user não escreve eventos direto", async () => {
    const { id } = await sentQuote(account);
    await expect(
      withUserDb(account, (tx) =>
        tx.insert(quoteEvents).values({
          quoteId: id,
          userId: account,
          type: "approved",
          quoteVersion: 1,
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("renderPublicPdf (D7)", () => {
  it("gera o PDF do link, sem contar visualização", async () => {
    const { id, token } = await sentQuote(account);
    const result = await renderPublicPdf(token, `10.0.0.${Math.floor(Math.random() * 200)}`);
    if (result.status !== "ok") throw new Error("PDF não gerado.");
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
    expect(result.fileName).toMatch(/^Orcamento-\d{4}\.pdf$/);
    const [row] = await owner<{ view_count: number }[]>`
      select view_count from public.quotes where id = ${id}`;
    expect(row?.view_count).toBe(0);
  });

  it("token de rascunho não gera; passa de 10 por minuto: limite (RN-39)", async () => {
    const draft = await createQuote(account);
    if (draft.status !== "created") throw new Error("Orçamento não criado.");
    const ip = `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    expect(await renderPublicPdf(await tokenOf(draft.id), ip)).toEqual({ status: "not_found" });

    for (let index = 0; index < PUBLIC_PDF_LIMIT_PER_MINUTE; index++) {
      await checkRateLimit(`pdf:ip:${ip}`, PUBLIC_PDF_LIMIT_PER_MINUTE, 60);
    }
    expect(await renderPublicPdf("x", ip)).toEqual({ status: "limit" });
  });
});

describe("página pública (NBB-53)", () => {
  it("reconhece o dono logado pelo token, e só ele (P3-A)", async () => {
    const { token } = await sentQuote(account);
    expect(await isQuoteOwner(account, token)).toBe(true);
    expect(await isQuoteOwner(await createAccount(), token)).toBe(false);
    expect(await isQuoteOwner(account, "x")).toBe(false);
  });

  it("monta a página com os mesmos textos do PDF", async () => {
    const { token } = await sentQuote(account);
    const quote = await getPublicQuote(token);
    if (!quote) throw new Error("Orçamento não encontrado.");
    expect(publicDocumentModel(quote)).toMatchObject({
      issuer: { name: "Estúdio Exemplo", logoPng: null },
      lines: [
        { description: "Logo", quantity: "1,5", unit: "h" },
        { description: "Site", quantity: "1,5", unit: "h" },
      ],
      totals: { total: expect.stringMatching(/^R\$\s4\.200,00$/u) },
    });
  });
});
