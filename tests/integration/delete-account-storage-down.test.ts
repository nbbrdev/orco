import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { deleteAccount } from "@/features/auth/delete-account";
import { closeDb, getAuthDb, withUserDb } from "@/lib/db";
import { profiles, user } from "@/lib/db/schema";
import type * as storage from "@/lib/storage";

// Exclusão de conta com o RustFS fora do ar (NBB-43 E2-A): se o logo não puder ser apagado, a conta
// fica intacta e a pessoa tenta de novo depois. O RustFS é simulado só neste arquivo.

vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof storage>()),
  deleteObject: vi.fn().mockRejectedValue(new Error("RustFS fora do ar")),
}));

const emails: string[] = [];

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await closeDb();
});

describe("deleteAccount com o RustFS fora do ar", () => {
  it("não apaga a conta se o logo não puder ser apagado", async () => {
    const email = `teste-${randomUUID()}@example.com`;
    emails.push(email);
    const [created] = await getAuthDb()
      .insert(user)
      .values({ name: "Teste", email })
      .returning({ id: user.id });
    const id = created?.id ?? "";
    // Um logo "existente" no perfil, sem precisar subir arquivo (o RustFS está simulado).
    await withUserDb(id, (tx) =>
      tx
        .update(profiles)
        .set({ logoPath: `${randomUUID()}.png` })
        .where(eq(profiles.id, id)),
    );

    expect(await deleteAccount(id, "EXCLUIR")).toEqual({ status: "failed" });

    expect(await getAuthDb().select().from(user).where(eq(user.id, id))).toHaveLength(1);
  });
});
