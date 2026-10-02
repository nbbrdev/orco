import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/[...all]/route";
import { registerUser, resendConfirmation, SIGN_UP_LIMIT } from "@/features/auth/sign-up";
import { closeDb, getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

// Anti-abuso do cadastro (RN-46) contra o Postgres e o Mailpit reais (NBB-39).

const owner = postgres(process.env.DATABASE_URL_OWNER ?? "", { max: 1, onnotice: () => {} });
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const password = "senha-de-teste-123";
const createdEmails: string[] = [];

function newEmail(): string {
  const email = `teste-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

/** IP único por teste: os limites por IP não interferem entre os testes. */
function newIp(): string {
  return `203.0.113.${Math.floor(Math.random() * 250)}-${randomUUID()}`;
}

async function mailsTo(email: string): Promise<number> {
  const response = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  const body = (await response.json()) as { messages_count: number };
  return body.messages_count;
}

async function resetDailyCap(): Promise<void> {
  await owner`delete from public.rate_limits where key = 'signup-email:day'`;
}

beforeEach(resetDailyCap);

afterAll(async () => {
  await resetDailyCap();
  if (createdEmails.length > 0) {
    await getAuthDb().delete(user).where(inArray(user.email, createdEmails));
  }
  await owner.end();
  await closeDb();
});

describe("check_rate_limit", () => {
  it("permite até o limite e recusa a partir dele", async () => {
    const key = `teste:${randomUUID()}`;
    expect(await checkRateLimit(key, 2, 3600)).toBe(true);
    expect(await checkRateLimit(key, 2, 3600)).toBe(true);
    expect(await checkRateLimit(key, 2, 3600)).toBe(false);
  });
});

describe("registerUser", () => {
  it("cria a conta e envia o e-mail de confirmação", async () => {
    const email = newEmail();
    expect(await registerUser({ email, password }, newIp())).toEqual({ status: "sent", email });

    const [created] = await getAuthDb().select().from(user).where(eq(user.email, email));
    expect(created?.emailVerified).toBe(false);
    // N1-B: o nome técnico é a parte antes do @.
    expect(created?.name).toBe(email.split("@")[0]);
    expect(await mailsTo(email)).toBe(1);
  });

  it("honeypot preenchido: mesma resposta, sem conta e sem e-mail", async () => {
    const email = newEmail();
    expect(await registerUser({ email, password, website: "spam.example" }, newIp())).toEqual({
      status: "sent",
      email,
    });
    expect(await getAuthDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
    expect(await mailsTo(email)).toBe(0);
  });

  it("e-mail já cadastrado: mesma resposta, sem segundo e-mail", async () => {
    const email = newEmail();
    await registerUser({ email, password }, newIp());
    expect(await registerUser({ email, password }, newIp())).toEqual({ status: "sent", email });
    expect(await mailsTo(email)).toBe(1);
  });

  it("recusa a 4ª tentativa do mesmo IP na hora", async () => {
    const ip = newIp();
    for (let i = 0; i < SIGN_UP_LIMIT.perIpPerHour; i++) {
      await registerUser({ email: newEmail(), password }, ip);
    }
    expect(await registerUser({ email: newEmail(), password }, ip)).toEqual({
      status: "rate-limited",
    });
  });

  it("respeita o teto diário de e-mails", async () => {
    for (let i = 0; i < SIGN_UP_LIMIT.emailsPerDay; i++) {
      await checkRateLimit("signup-email:day", SIGN_UP_LIMIT.emailsPerDay, 86400);
    }
    const email = newEmail();
    expect(await registerUser({ email, password }, newIp())).toEqual({ status: "daily-cap" });
    expect(await getAuthDb().select().from(user).where(eq(user.email, email))).toHaveLength(0);
  });
});

describe("resendConfirmation", () => {
  it("reenvia para conta não confirmada e responde igual para e-mail inexistente", async () => {
    const email = newEmail();
    await registerUser({ email, password }, newIp());
    expect(await resendConfirmation(email, newIp())).toEqual({ status: "sent" });
    expect(await mailsTo(email)).toBe(2);
    expect(await resendConfirmation(newEmail(), newIp())).toEqual({ status: "sent" });
  });
});

describe("portas diretas da API (C2)", () => {
  it.each(["/api/auth/sign-up/email", "/api/auth/send-verification-email"])(
    "%s responde 404",
    async (path) => {
      const response = await POST(
        new Request(`http://localhost:3000${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ email: newEmail(), password, name: "x" }),
        }),
      );
      expect(response.status).toBe(404);
    },
  );
});
