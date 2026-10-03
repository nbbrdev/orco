import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { deleteAccount } from "@/features/auth/delete-account";
import { closeDb, getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import type * as email from "@/lib/email";

// Exclusão de conta com o envio de e-mail falhando (NBB-82, X1-A): a conta é excluída mesmo assim;
// o aviso perdido só vai para o log. O envio é simulado só neste arquivo.

vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof email>()),
  sendEmail: vi.fn().mockRejectedValue(new Error("SMTP fora do ar")),
}));

const emails: string[] = [];

afterAll(async () => {
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await closeDb();
});

describe("deleteAccount com o e-mail fora do ar", () => {
  it("exclui a conta mesmo sem conseguir avisar", async () => {
    const address = `teste-${randomUUID()}@example.com`;
    emails.push(address);
    const [created] = await getAuthDb()
      .insert(user)
      .values({ name: "Teste", email: address })
      .returning({ id: user.id });
    const id = created?.id ?? "";

    expect(await deleteAccount(id, "EXCLUIR")).toEqual({ status: "deleted" });
    expect(await getAuthDb().select().from(user).where(eq(user.id, id))).toHaveLength(0);
  });
});
