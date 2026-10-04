import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET } from "@/app/api/orcamentos/[id]/pdf/route";
import { saveClient } from "@/features/clients/clients";
import { uploadLogo } from "@/features/profile/logo";
import { updateProfileField } from "@/features/profile/profile";
import { loadQuotePdf, PDF_LIMIT_PER_MINUTE, renderOwnerPdf } from "@/features/quotes/pdf";
import { createQuote, getQuoteForEditor, saveQuoteItems } from "@/features/quotes/quotes";
import { closeDb, getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

// O PDF do dono (NBB-51, PR 1) contra o Postgres e o RustFS reais: os dados vêm do orçamento, do
// perfil e do logo (convertido de WebP), só da própria conta (RLS); a prévia não muda o status
// (RN-22a); e o limite de 20 por minuto (RN-39).

const emails: string[] = [];

async function createAccount(): Promise<{ id: string; email: string }> {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const [created] = await getAuthDb()
    .insert(user)
    .values({ name: "Teste", email })
    .returning({ id: user.id });
  return { id: created?.id ?? "", email };
}

async function newQuote(userId: string, clientId: string | null = null): Promise<string> {
  const result = await createQuote(userId, clientId);
  if (result.status !== "created") throw new Error("Orçamento não criado.");
  return result.id;
}

const item = (description: string, unitPrice: string) => ({
  id: randomUUID(),
  description,
  quantity: "1",
  unit: "",
  unitPrice,
  catalogItemId: null,
});

let owner = { id: "", email: "" };

beforeAll(async () => {
  owner = await createAccount();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await closeDb();
});

describe("loadQuotePdf", () => {
  it("junta o orçamento, o perfil e o logo em PNG", async () => {
    const account = await createAccount();
    await updateProfileField(account.id, "businessName", "Estúdio Exemplo");
    const webp = await sharp({
      create: { width: 8, height: 8, channels: 4, background: "#7c3aed" },
    })
      .webp()
      .toBuffer();
    expect((await uploadLogo(account.id, new Uint8Array(webp))).status).toBe("saved");
    const client = await saveClient(account.id, null, {
      name: "Maria Silva",
      email: "",
      phone: "",
      document: "",
      address: "",
      internalNotes: "",
    });
    if (client.status !== "saved") throw new Error("Cliente não criado.");
    const quoteId = await newQuote(account.id, client.client.id);
    await saveQuoteItems(account.id, quoteId, { items: [item("Logo", "800")] });

    const pdf = await loadQuotePdf(account, quoteId);
    expect(pdf?.fileName).toBe("Orcamento-0001-Maria-Silva.pdf");
    expect(pdf?.input).toMatchObject({
      accountEmail: account.email,
      profile: { businessName: "Estúdio Exemplo" },
      quote: { number: 1, status: "draft", sentAt: null, client: { name: "Maria Silva" } },
    });
    expect(pdf?.input.quote.items).toHaveLength(1);
    // Assinatura do PNG: 89 50 4E 47.
    expect([...(pdf?.input.logoPng ?? new Uint8Array()).slice(0, 4)]).toEqual([
      0x89, 0x50, 0x4e, 0x47,
    ]);
  });

  it("orçamento de outra conta (ou id inválido) não existe", async () => {
    const other = await createAccount();
    const quoteId = await newQuote(owner.id);
    expect(await loadQuotePdf(other, quoteId)).toBeNull();
    expect(await loadQuotePdf(owner, "x")).toBeNull();
  });
});

describe("GET /api/orcamentos/[id]/pdf", () => {
  it("devolve a prévia sem mudar o status (RN-22a)", async () => {
    const account = await createAccount();
    const quoteId = await newQuote(account.id);
    const result = await renderOwnerPdf(account, quoteId);
    if (result.status !== "ok") throw new Error("PDF não gerado.");
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
    expect(result.fileName).toBe("Orcamento-0001.pdf");
    expect((await getQuoteForEditor(account.id, quoteId))?.status).toBe("draft");
  });

  it("sem sessão, a rota responde 401", async () => {
    const response = await GET(new Request("http://localhost:3000/api/orcamentos/x/pdf"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(response.status).toBe(401);
  });

  it(`passa de ${PDF_LIMIT_PER_MINUTE} por minuto: limite (RN-39)`, async () => {
    const account = await createAccount();
    const quoteId = await newQuote(account.id);
    for (let index = 0; index < PDF_LIMIT_PER_MINUTE; index++) {
      await checkRateLimit(`pdf:user:${account.id}`, PDF_LIMIT_PER_MINUTE, 60);
    }
    expect(await renderOwnerPdf(account, quoteId)).toEqual({ status: "limit" });
  });
});
