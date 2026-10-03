import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { deleteAccount } from "@/features/auth/delete-account";
import { uploadLogo } from "@/features/profile/logo";
import { getProfile } from "@/features/profile/profile";
import { getAuth } from "@/lib/auth";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { account, profiles, session, user } from "@/lib/db/schema";
import { getObject } from "@/lib/storage";

// Exclusão de conta (F-17, RN-06, NBB-43) contra o Postgres e o RustFS reais.

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const password = "senha-de-teste-123";
const leftovers: string[] = [];

/** Conta confirmada, com sessão aberta, conta de login (senha) e logo. */
async function fullAccount(): Promise<{ id: string; logoPath: string }> {
  const email = `teste-${randomUUID()}@example.com`;
  leftovers.push(email);
  await getAuth().api.signUpEmail({ body: { email, password, name: "Teste" } });
  await getAuthDb().update(user).set({ emailVerified: true }).where(eq(user.email, email));
  const { user: created } = await getAuth().api.signInEmail({ body: { email, password } });
  const upload = await uploadLogo(created.id, PNG);
  return { id: created.id, logoPath: upload.status === "saved" ? (upload.logoPath ?? "") : "" };
}

async function countRows(userId: string) {
  const db = getAuthDb();
  const [users, sessions, accounts] = await Promise.all([
    db.select().from(user).where(eq(user.id, userId)),
    db.select().from(session).where(eq(session.userId, userId)),
    db.select().from(account).where(eq(account.userId, userId)),
  ]);
  const profileRows = await withUserDb(userId, (tx) =>
    tx.select().from(profiles).where(eq(profiles.id, userId)),
  );
  return {
    users: users.length,
    sessions: sessions.length,
    accounts: accounts.length,
    profiles: profileRows.length,
  };
}

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, leftovers));
  await closeDb();
});

describe("deleteAccount", () => {
  it("apaga a conta, as sessões, o login, o perfil e o logo (RN-06)", async () => {
    const { id, logoPath } = await fullAccount();
    expect(await countRows(id)).toEqual({ users: 1, sessions: 1, accounts: 1, profiles: 1 });
    expect(await getObject(logoPath)).not.toBeNull();

    expect(await deleteAccount(id, "EXCLUIR")).toEqual({ status: "deleted" });

    expect(await countRows(id)).toEqual({ users: 0, sessions: 0, accounts: 0, profiles: 0 });
    expect(await getObject(logoPath)).toBeNull();
  });

  it("sem EXCLUIR exato, nada acontece", async () => {
    const { id, logoPath } = await fullAccount();

    for (const typed of ["", "excluir", "EXCLUIR ", "SIM", undefined]) {
      expect(await deleteAccount(id, typed)).toEqual({ status: "unconfirmed" });
    }

    expect((await countRows(id)).users).toBe(1);
    expect((await getProfile(id)).logoPath).toBe(logoPath);
    expect(await getObject(logoPath)).not.toBeNull();
  });
});
