import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getProfile, updateProfileField } from "@/features/profile/profile";
import { closeDb, getAppDb, getAuthDb, withUserDb } from "@/lib/db";
import { profiles, user } from "@/lib/db/schema";

// A primeira tabela do produto (NBB-42), contra o Postgres real: o trigger cria o perfil, a RLS só
// deixa cada conta ver e alterar o próprio, e a app_user não insere, não apaga nem mexe nas colunas
// do sistema (docs/07 §3).

const emails: string[] = [];

async function createAccount(): Promise<string> {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  // Como o Better Auth faz: a app_auth insere em auth.user, e o trigger cria o perfil.
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

describe("profiles", () => {
  it("nasce com a conta, com os padrões do docs/05 (D1)", async () => {
    const profile = await getProfile(userA);
    expect(profile.displayName).toBeNull();
    expect(profile.defaultValidityDays).toBe(15);
    expect(profile.emailNotifications).toBe(true);
  });

  it("cada conta só vê o próprio perfil", async () => {
    const visible = await withUserDb(userA, (tx) => tx.select({ id: profiles.id }).from(profiles));
    expect(visible.map((row) => row.id)).toEqual([userA]);
  });

  it("uma conta não altera o perfil de outra", async () => {
    await withUserDb(userB, (tx) =>
      tx.update(profiles).set({ displayName: "invadido" }).where(eq(profiles.id, userA)),
    );
    expect((await getProfile(userA)).displayName).toBeNull();
  });

  it("fora do withUserDb (sem usuário na transação), nada aparece", async () => {
    expect(await getAppDb().select().from(profiles)).toHaveLength(0);
  });

  it("a app_user não insere, não apaga e não mexe no contador de orçamentos", async () => {
    expect(
      await postgresErrorOf(withUserDb(userA, (tx) => tx.insert(profiles).values({ id: userA }))),
    ).toMatch(/permission denied/);
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) => tx.delete(profiles).where(eq(profiles.id, userA))),
      ),
    ).toMatch(/permission denied/);
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) => tx.update(profiles).set({ nextQuoteNumber: 1 })),
      ),
    ).toMatch(/permission denied/);
  });

  it("salva um campo já limpo e atualiza o updated_at (D3, D4)", async () => {
    const before = await withUserDb(userA, (tx) =>
      tx.execute<{ updated_at: string }>(sql`select updated_at from profiles`),
    );
    expect(
      await updateProfileField(userA, "instagram", "https://instagram.com/meunegocio"),
    ).toEqual({ status: "saved", value: "@meunegocio" });
    expect((await getProfile(userA)).instagram).toBe("@meunegocio");

    const after = await withUserDb(userA, (tx) =>
      tx.execute<{ updated_at: string }>(sql`select updated_at from profiles`),
    );
    expect(new Date(after[0]?.updated_at ?? 0).getTime()).toBeGreaterThan(
      new Date(before[0]?.updated_at ?? 0).getTime(),
    );
  });

  it("valor inválido não é gravado", async () => {
    const result = await updateProfileField(userA, "document", "529.982.247-24");
    expect(result.status).toBe("invalid");
    expect((await getProfile(userA)).document).toBeNull();
  });

  it("a exclusão da conta apaga o perfil em cascata", async () => {
    const id = await createAccount();
    await getAuthDb().delete(user).where(eq(user.id, id));
    const visible = await withUserDb(id, (tx) => tx.select().from(profiles));
    expect(visible).toHaveLength(0);
  });
});
