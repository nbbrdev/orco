import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { getAuth } from "@/lib/auth";
import { closeDb, getAppDb, getAuthDb } from "@/lib/db";
import { account, user } from "@/lib/db/schema";

// Prova, contra um Postgres real, a base do login (ADR-0013/0014, NBB-79): o Better Auth grava no
// schema `auth` com a role app_auth, e o produto (app_user) não enxerga essas tabelas.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const email = `teste-${randomUUID()}@example.com`;
const password = "senha-de-teste-123";

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

afterAll(async () => {
  // O cascade apaga também as contas e sessões do usuário de teste.
  await getAuthDb().delete(user).where(eq(user.email, email));
  await closeDb();
});

describe("Better Auth", () => {
  it("cria o usuário em auth.user com id uuid e a senha só como hash", async () => {
    await getAuth().api.signUpEmail({ body: { email, password, name: "Teste" } });

    const [created] = await getAuthDb().select().from(user).where(eq(user.email, email));
    expect(created?.id).toMatch(UUID);
    // RN-02: começa sem e-mail confirmado.
    expect(created?.emailVerified).toBe(false);

    const [credential] = await getAuthDb()
      .select({ password: account.password })
      .from(account)
      .where(eq(account.userId, created?.id ?? ""));
    expect(credential?.password).toBeTruthy();
    expect(credential?.password).not.toContain(password);
  });

  it("recusa senha com menos de 8 caracteres (RN-03)", async () => {
    await expect(
      getAuth().api.signUpEmail({
        body: { email: `curta-${randomUUID()}@example.com`, password: "1234567", name: "Teste" },
      }),
    ).rejects.toThrow();
  });
});

describe("isolamento do schema auth", () => {
  it("app_user não lê as tabelas de login", async () => {
    expect(await postgresErrorOf(getAppDb().execute(sql`select 1 from auth.user`))).toMatch(
      /permission denied/,
    );
  });

  it("app_user não grava nas tabelas de login", async () => {
    expect(await postgresErrorOf(getAppDb().execute(sql`delete from auth.session`))).toMatch(
      /permission denied/,
    );
  });
});
