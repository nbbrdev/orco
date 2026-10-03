import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CLIENT_LIMIT_MESSAGE,
  deleteClient,
  listClients,
  saveClient,
} from "@/features/clients/clients";
import { closeDb, getAppDb, getAuthDb, withUserDb } from "@/lib/db";
import { clients, MAX_CLIENTS_PER_USER, user } from "@/lib/db/schema";

// Clientes (F-15, NBB-44) contra o Postgres real: a RLS só deixa cada conta alcançar os próprios
// clientes, a app_user não mexe nas colunas do sistema, e o trigger garante o limite de 1.000
// (RN-38), mesmo com dois cadastros ao mesmo tempo (K8-A).

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

const empty = { email: "", phone: "", document: "", address: "", internalNotes: "" };

async function create(userId: string, name: string) {
  const result = await saveClient(userId, null, { ...empty, name });
  if (result.status !== "saved") {
    throw new Error(`Cliente não criado: ${result.status}`);
  }
  return result.client;
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

describe("clients", () => {
  it("cria, lista em ordem alfabética, edita e exclui", async () => {
    const bruno = await create(userA, "Bruno");
    await create(userA, "Ana");
    expect((await listClients(userA)).map((client) => client.name)).toEqual(["Ana", "Bruno"]);

    const edited = await saveClient(userA, bruno.id, {
      ...empty,
      name: "Bruno Lima",
      document: "529.982.247-25",
      internalNotes: "Prefere WhatsApp",
    });
    expect(edited).toMatchObject({
      status: "saved",
      client: { name: "Bruno Lima", document: "52998224725", internalNotes: "Prefere WhatsApp" },
    });

    expect(await deleteClient(userA, bruno.id)).toEqual({ status: "deleted" });
    expect((await listClients(userA)).map((client) => client.name)).toEqual(["Ana"]);
  });

  it("devolve os erros por campo e não grava (RN-07, RN-08)", async () => {
    const result = await saveClient(userA, null, { ...empty, name: "", document: "111" });
    expect(result).toEqual({
      status: "invalid",
      errors: {
        name: "Informe o nome do cliente.",
        document: "CPF ou CNPJ inválido. Confira os números.",
      },
    });
  });

  it("cada conta só vê, altera e exclui os próprios clientes", async () => {
    const own = await create(userA, "Cliente do A");

    expect((await listClients(userB)).map((client) => client.id)).not.toContain(own.id);
    expect(await saveClient(userB, own.id, { ...empty, name: "invadido" })).toEqual({
      status: "not_found",
    });
    expect(await deleteClient(userB, own.id)).toEqual({ status: "not_found" });
    expect((await listClients(userA)).map((client) => client.name)).toContain("Cliente do A");
  });

  it("id que não é UUID é tratado como cliente inexistente", async () => {
    expect(await saveClient(userA, "1 or 1=1", { ...empty, name: "x" })).toEqual({
      status: "not_found",
    });
    expect(await deleteClient(userA, "1 or 1=1")).toEqual({ status: "not_found" });
  });

  it("não cria cliente em nome de outra conta", async () => {
    expect(
      await postgresErrorOf(
        withUserDb(userB, (tx) => tx.insert(clients).values({ userId: userA, name: "falso" })),
      ),
    ).toMatch(/row-level security/);
  });

  it("fora do withUserDb (sem usuário na transação), nada aparece", async () => {
    expect(await getAppDb().select().from(clients)).toHaveLength(0);
  });

  it("a app_user não troca o dono nem as datas", async () => {
    const own = await create(userA, "Datas");
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) =>
          tx.update(clients).set({ userId: userB }).where(eq(clients.id, own.id)),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) =>
          tx
            .update(clients)
            .set({ createdAt: new Date(0) })
            .where(eq(clients.id, own.id)),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("o updated_at muda a cada edição", async () => {
    const own = await create(userA, "Antes");
    await saveClient(userA, own.id, { ...empty, name: "Depois" });
    const [row] = await withUserDb(userA, (tx) =>
      tx.execute<{ changed: boolean }>(
        sql`select updated_at > created_at as changed from clients where id = ${own.id}`,
      ),
    );
    expect(row?.changed).toBe(true);
  });

  it("a exclusão da conta apaga os clientes em cascata", async () => {
    const id = await createAccount();
    await create(id, "Some com a conta");
    await getAuthDb().delete(user).where(eq(user.id, id));
    expect(await withUserDb(id, (tx) => tx.select().from(clients))).toHaveLength(0);
  });
});

describe("limite de 1.000 clientes (RN-38)", () => {
  let userC = "";

  beforeAll(async () => {
    userC = await createAccount();
    // 999 de uma vez: o trigger roda linha a linha e conta as já inseridas no mesmo comando.
    await withUserDb(userC, (tx) =>
      tx.insert(clients).values(
        Array.from({ length: MAX_CLIENTS_PER_USER - 1 }, (_, index) => ({
          userId: userC,
          name: `Cliente ${index + 1}`,
        })),
      ),
    );
  });

  it("dois cadastros ao mesmo tempo no cliente 1.000: só um passa (K8-A)", async () => {
    const results = await Promise.all([
      saveClient(userC, null, { ...empty, name: "Corrida 1" }),
      saveClient(userC, null, { ...empty, name: "Corrida 2" }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["limit", "saved"]);
    expect(await listClients(userC)).toHaveLength(MAX_CLIENTS_PER_USER);
  });

  it("o 1.001º é recusado com a mensagem clara", async () => {
    expect(await saveClient(userC, null, { ...empty, name: "Mais um" })).toEqual({
      status: "limit",
      message: CLIENT_LIMIT_MESSAGE,
    });
  });

  it("o limite vale também para quem grava direto no banco", async () => {
    expect(
      await postgresErrorOf(
        withUserDb(userC, (tx) => tx.insert(clients).values({ userId: userC, name: "Direto" })),
      ),
    ).toMatch(/Limite de 1000 clientes/);
  });

  it("excluir um cliente libera a vaga", async () => {
    const [first] = await listClients(userC);
    await deleteClient(userC, first?.id ?? "");
    expect((await saveClient(userC, null, { ...empty, name: "Nova vaga" })).status).toBe("saved");
  });

  it("o limite é por conta: as outras continuam cadastrando", async () => {
    expect((await saveClient(userB, null, { ...empty, name: "Livre" })).status).toBe("saved");
  });
});
