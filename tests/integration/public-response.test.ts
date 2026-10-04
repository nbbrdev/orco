import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonymizeOldEventIps,
  getPublicQuote,
  RESPOND_LIMIT_PER_MINUTE,
  respondToQuote,
} from "@/features/public-quote/public-quote";
import {
  createQuote,
  regeneratePublicToken,
  saveQuoteItems,
  sendQuote,
} from "@/features/quotes/quotes";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { quotes, user } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

// A resposta do cliente, o novo link e a anonimização (NBB-52, PR 2) contra o Postgres real:
// resposta única, só enviado e dentro da validade (RN-32), com nome ou motivo (RN-33), evidência
// (RN-34) e a versão que a página mostrou (R2-A); novo link em qualquer status (RN-36, R1-A); e o IP
// apagado depois de 12 meses (RN-37).

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

async function sentQuote(userId: string) {
  const created = await createQuote(userId);
  if (created.status !== "created") throw new Error("Orçamento não criado.");
  await saveQuoteItems(userId, created.id, {
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
  expect(await sendQuote(userId, created.id)).toBe("sent");
  const [row] = await owner<{ public_token: string }[]>`
    select public_token from public.quotes where id = ${created.id}`;
  return { id: created.id, token: row?.public_token ?? "" };
}

/** Um IP diferente por chamada, para o limite de 5 por minuto não atrapalhar os outros testes. */
const someIp = () =>
  `200.150.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function events(id: string) {
  return owner<
    {
      type: string;
      quote_version: number;
      ip: string | null;
      respondent_name: string | null;
      reason_code: string | null;
      reason: string | null;
    }[]
  >`select type, quote_version, host(ip) as ip, respondent_name, reason_code, reason
      from public.quote_events where quote_id = ${id} order by created_at`;
}

let account = "";

beforeAll(async () => {
  account = await createAccount();
});

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await owner.end();
  await closeDb();
});

describe("respondToQuote (RN-32 a RN-34)", () => {
  it("aprova com o nome, registra a evidência e não aceita uma segunda resposta", async () => {
    const { id, token } = await sentQuote(account);
    const ip = someIp();
    expect(
      await respondToQuote(
        token,
        { decision: "approved", version: 1, respondentName: "  Maria Silva  " },
        ip,
        "Mozilla/5.0",
      ),
    ).toBe("ok");

    const [quote] = await owner<{ status: string; responded_at: Date | null }[]>`
      select status, responded_at from public.quotes where id = ${id}`;
    expect(quote?.status).toBe("approved");
    expect(quote?.responded_at).toBeInstanceOf(Date);
    expect(await events(id)).toEqual([
      {
        type: "approved",
        quote_version: 1,
        ip,
        respondent_name: "Maria Silva",
        reason_code: null,
        reason: null,
      },
    ]);
    expect((await getPublicQuote(token))?.status).toBe("approved");

    // A resposta é definitiva (RN-32).
    expect(await respondToQuote(token, { decision: "rejected", version: 1 }, someIp(), null)).toBe(
      "already_responded",
    );
  });

  it("recusa com o motivo; o nome é ignorado na recusa", async () => {
    const { id, token } = await sentQuote(account);
    expect(
      await respondToQuote(
        token,
        {
          decision: "rejected",
          version: 1,
          reasonCode: "price",
          reason: "Ficou acima do previsto.",
        },
        someIp(),
        null,
      ),
    ).toBe("ok");
    expect(await events(id)).toEqual([
      expect.objectContaining({
        type: "rejected",
        respondent_name: null,
        reason_code: "price",
        reason: "Ficou acima do previsto.",
      }),
    ]);
  });

  it("vencido, rascunho, token inválido e entrada inválida não respondem", async () => {
    const expired = await sentQuote(account);
    await owner`update public.quotes set valid_until = current_date - 2 where id = ${expired.id}`;
    expect(
      await respondToQuote(expired.token, { decision: "approved", version: 1 }, someIp(), null),
    ).toBe("expired");

    const draft = await createQuote(account);
    if (draft.status !== "created") throw new Error("Orçamento não criado.");
    const [row] = await owner<{ public_token: string }[]>`
      select public_token from public.quotes where id = ${draft.id}`;
    expect(
      await respondToQuote(
        row?.public_token ?? "",
        { decision: "approved", version: 1 },
        someIp(),
        null,
      ),
    ).toBe("not_found");
    expect(await respondToQuote("x", { decision: "approved", version: 1 }, someIp(), null)).toBe(
      "not_found",
    );

    const { token } = await sentQuote(account);
    expect(await respondToQuote(token, { decision: "maybe", version: 1 }, someIp(), null)).toBe(
      "invalid",
    );
    expect(
      await respondToQuote(
        token,
        { decision: "approved", version: 1, respondentName: "a".repeat(121) },
        someIp(),
        null,
      ),
    ).toBe("invalid");
  });

  it("orçamento editado depois que a página abriu: pede para conferir de novo (R2-A)", async () => {
    const { id, token } = await sentQuote(account);
    await withUserDb(account, (tx) =>
      tx.update(quotes).set({ notes: "Novo prazo" }).where(eq(quotes.id, id)),
    );
    expect(await respondToQuote(token, { decision: "approved", version: 1 }, someIp(), null)).toBe(
      "outdated",
    );
    expect(await respondToQuote(token, { decision: "approved", version: 2 }, someIp(), null)).toBe(
      "ok",
    );
    expect((await events(id))[0]?.quote_version).toBe(2);
  });

  it(`passa de ${RESPOND_LIMIT_PER_MINUTE} por minuto no mesmo IP e token: limite (RN-39)`, async () => {
    const { token } = await sentQuote(account);
    const ip = someIp();
    for (let index = 0; index < RESPOND_LIMIT_PER_MINUTE; index++) {
      await checkRateLimit(`respond:${ip}:${token}`, RESPOND_LIMIT_PER_MINUTE, 60);
    }
    expect(await respondToQuote(token, { decision: "approved", version: 1 }, ip, null)).toBe(
      "limit",
    );
  });

  it("o freelancer continua sem poder aprovar pelo app (só a função)", async () => {
    const { id } = await sentQuote(account);
    await expect(
      withUserDb(account, (tx) =>
        tx.update(quotes).set({ status: "approved" }).where(eq(quotes.id, id)),
      ),
    ).rejects.toThrow();
  });
});

describe("regeneratePublicToken (RN-36, R1-A)", () => {
  it("troca o token na hora, sem subir a versão", async () => {
    const { id, token } = await sentQuote(account);
    const fresh = await regeneratePublicToken(account, id);
    expect(fresh).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fresh).not.toBe(token);
    expect(await getPublicQuote(token)).toBeNull();
    expect((await getPublicQuote(fresh ?? ""))?.version).toBe(1);
  });

  it("vale também para aprovado e recusado", async () => {
    const { id, token } = await sentQuote(account);
    expect(await respondToQuote(token, { decision: "approved", version: 1 }, someIp(), null)).toBe(
      "ok",
    );
    const fresh = await regeneratePublicToken(account, id);
    expect((await getPublicQuote(fresh ?? ""))?.status).toBe("approved");
  });

  it("orçamento de outra conta (ou id inválido) não muda", async () => {
    const { id, token } = await sentQuote(account);
    const other = await createAccount();
    expect(await regeneratePublicToken(other, id)).toBeNull();
    expect(await regeneratePublicToken(account, "x")).toBeNull();
    expect(await getPublicQuote(token)).not.toBeNull();
  });
});

describe("anonymizeOldEventIps (RN-37, D6-A)", () => {
  it("apaga o IP dos eventos com mais de 12 meses e deixa os recentes", async () => {
    const { id, token } = await sentQuote(account);
    expect(await respondToQuote(token, { decision: "approved", version: 1 }, someIp(), null)).toBe(
      "ok",
    );
    const [recent] = await owner<{ user_id: string }[]>`
      select user_id from public.quotes where id = ${id}`;
    await owner`
      insert into public.quote_events (quote_id, user_id, type, quote_version, ip, created_at)
      values (${id}, ${recent?.user_id ?? ""}, 'viewed', 1, '200.150.10.7', now() - interval '13 months')`;

    expect(await anonymizeOldEventIps()).toBeGreaterThanOrEqual(1);
    const rows = await owner<{ type: string; ip: string | null }[]>`
      select type, host(ip) as ip from public.quote_events where quote_id = ${id} order by created_at`;
    expect(rows[0]).toEqual({ type: "viewed", ip: null });
    expect(rows[1]?.ip).not.toBeNull();
  });
});
