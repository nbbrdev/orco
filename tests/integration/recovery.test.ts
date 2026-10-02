import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/[...all]/route";
import {
  RECOVERY_LIMIT_PER_IP_PER_HOUR,
  requestRecovery,
  resetPassword,
} from "@/features/auth/recovery";
import { getAuth } from "@/lib/auth";
import { closeDb, getAuthDb } from "@/lib/db";
import { session, user } from "@/lib/db/schema";

// Recuperação de senha (F-04, NBB-41) contra o Postgres e o Mailpit reais.

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const password = "senha-de-teste-123";
const newPassword = "senha-nova-456";
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

async function subjectsTo(email: string): Promise<string[]> {
  const response = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  const body = (await response.json()) as { messages: { Subject: string }[] };
  return body.messages.map((message) => message.Subject);
}

/** Token do link "Criar nova senha" do e-mail mais recente para `email`. */
async function resetToken(email: string): Promise<string> {
  const search = (await (
    await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}" subject:"Redefina sua senha"`)}`,
    )
  ).json()) as { messages: { ID: string }[] };
  const id = search.messages[0]?.ID ?? "";
  const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
    Text: string;
  };
  const token = /reset-password\/([^?\s]+)/.exec(message.Text)?.[1];
  if (!token) {
    throw new Error(`Link de redefinição para ${email} não encontrado no Mailpit.`);
  }
  return token;
}

/** Conta já confirmada e com uma sessão aberta. */
async function verifiedUserWithSession(): Promise<{ email: string; id: string }> {
  const email = newEmail();
  await getAuth().api.signUpEmail({ body: { email, password, name: "Teste" } });
  await getAuthDb().update(user).set({ emailVerified: true }).where(eq(user.email, email));
  const signedIn = await getAuth().api.signInEmail({ body: { email, password } });
  return { email, id: signedIn.user.id };
}

afterAll(async () => {
  if (createdEmails.length > 0) {
    // O cascade apaga também as contas e as sessões.
    await getAuthDb().delete(user).where(inArray(user.email, createdEmails));
  }
  await closeDb();
});

describe("requestRecovery + resetPassword", () => {
  it("troca a senha, avisa por e-mail, derruba as sessões e não aceita o link duas vezes", async () => {
    const { email, id } = await verifiedUserWithSession();
    expect(await getAuthDb().select().from(session).where(eq(session.userId, id))).toHaveLength(1);

    expect(await requestRecovery(email, newIp())).toEqual({ status: "sent" });
    const token = await resetToken(email);

    expect(await resetPassword({ token, password: newPassword })).toEqual({ status: "changed" });

    // P4: o aviso "Sua senha foi alterada" (docs/07 §1).
    expect(await subjectsTo(email)).toContain("Sua senha foi alterada");
    // P3: nenhuma sessão sobrevive à troca.
    expect(await getAuthDb().select().from(session).where(eq(session.userId, id))).toHaveLength(0);
    // A senha nova funciona; a antiga, não.
    await expect(
      getAuth().api.signInEmail({ body: { email, password: newPassword } }),
    ).resolves.toBeTruthy();
    await expect(getAuth().api.signInEmail({ body: { email, password } })).rejects.toThrow();
    // Uso único (docs/07 §1).
    expect(await resetPassword({ token, password: "outra-senha-789" })).toEqual({
      status: "invalid-token",
    });
  });

  it("e-mail inexistente: mesma resposta e nenhum e-mail", async () => {
    const email = newEmail();
    expect(await requestRecovery(email, newIp())).toEqual({ status: "sent" });
    expect(await subjectsTo(email)).toHaveLength(0);
  });

  it("recusa o 4º pedido do mesmo IP na hora (P1)", async () => {
    const ip = newIp();
    for (let i = 0; i < RECOVERY_LIMIT_PER_IP_PER_HOUR; i++) {
      expect(await requestRecovery(newEmail(), ip)).toEqual({ status: "sent" });
    }
    expect(await requestRecovery(newEmail(), ip)).toEqual({ status: "rate-limited" });
  });

  it("token inventado: link inválido (P9)", async () => {
    expect(await resetPassword({ token: "token-inventado", password: newPassword })).toEqual({
      status: "invalid-token",
    });
  });

  it("senha nova curta: recusada antes de chegar ao Better Auth (RN-03)", async () => {
    const result = await resetPassword({ token: "qualquer", password: "1234567" });
    expect(result.status).toBe("invalid");
  });
});

describe("porta direta da API (P1)", () => {
  it("/api/auth/request-password-reset responde 404", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ email: newEmail(), redirectTo: "/redefinir-senha" }),
      }),
    );
    expect(response.status).toBe(404);
  });
});
