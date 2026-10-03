import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CATALOG_LIMIT_MESSAGE,
  deleteCatalogItem,
  listCatalogItems,
  saveCatalogItem,
} from "@/features/catalog/catalog";
import { closeDb, getAppDb, getAuthDb, withUserDb } from "@/lib/db";
import { catalogItems, MAX_CATALOG_ITEMS_PER_USER, user } from "@/lib/db/schema";

// Catálogo (F-16, NBB-45) contra o Postgres real, no mesmo padrão dos clientes: RLS por conta,
// colunas do sistema protegidas, preço em centavos com teto, e o limite de 500 (RN-38) garantido
// pelo trigger, mesmo com dois cadastros ao mesmo tempo.

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

async function create(userId: string, name: string, unitPrice = "") {
  const result = await saveCatalogItem(userId, null, { name, unit: "", unitPrice });
  if (result.status !== "saved") {
    throw new Error(`Item não criado: ${result.status}`);
  }
  return result.item;
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

describe("catalog_items", () => {
  it("cria com preço em centavos, lista em ordem alfabética, edita e exclui", async () => {
    const site = await create(userA, "Site", "2.000,00");
    expect(site.unitPriceCents).toBe(200000);
    await create(userA, "Logo");
    expect((await listCatalogItems(userA)).map((item) => item.name)).toEqual(["Logo", "Site"]);

    const edited = await saveCatalogItem(userA, site.id, {
      name: "Site institucional",
      unit: "un",
      unitPrice: "",
    });
    expect(edited).toMatchObject({
      status: "saved",
      item: { name: "Site institucional", unit: "un", unitPriceCents: null },
    });

    expect(await deleteCatalogItem(userA, site.id)).toEqual({ status: "deleted" });
    expect((await listCatalogItems(userA)).map((item) => item.name)).toEqual(["Logo"]);
  });

  it("devolve os erros por campo e não grava (RN-10)", async () => {
    expect(await saveCatalogItem(userA, null, { name: "", unit: "", unitPrice: "abc" })).toEqual({
      status: "invalid",
      errors: {
        name: "Informe o nome do item.",
        unitPrice: "Informe um preço válido, ex.: 1.234,56",
      },
    });
  });

  it("o banco recusa preço negativo ou acima do teto (I3-A)", async () => {
    for (const unitPriceCents of [-1, 1_000_000_000]) {
      expect(
        await postgresErrorOf(
          withUserDb(userA, (tx) =>
            tx.insert(catalogItems).values({ userId: userA, name: "x", unitPriceCents }),
          ),
        ),
      ).toMatch(/catalog_items_unit_price_range/);
    }
  });

  it("cada conta só vê, altera e exclui os próprios itens", async () => {
    const own = await create(userA, "Item do A");
    expect((await listCatalogItems(userB)).map((item) => item.id)).not.toContain(own.id);
    expect(
      await saveCatalogItem(userB, own.id, { name: "invadido", unit: "", unitPrice: "" }),
    ).toEqual({ status: "not_found" });
    expect(await deleteCatalogItem(userB, own.id)).toEqual({ status: "not_found" });
    expect(await deleteCatalogItem(userA, "não-é-uuid")).toEqual({ status: "not_found" });
  });

  it("não cria item em nome de outra conta e nada aparece fora do withUserDb", async () => {
    expect(
      await postgresErrorOf(
        withUserDb(userB, (tx) => tx.insert(catalogItems).values({ userId: userA, name: "falso" })),
      ),
    ).toMatch(/row-level security/);
    expect(await getAppDb().select().from(catalogItems)).toHaveLength(0);
  });

  it("a app_user não troca o dono nem as datas", async () => {
    const own = await create(userA, "Datas");
    expect(
      await postgresErrorOf(
        withUserDb(userA, (tx) =>
          tx.update(catalogItems).set({ userId: userB }).where(eq(catalogItems.id, own.id)),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("a exclusão da conta apaga os itens em cascata", async () => {
    const id = await createAccount();
    await create(id, "Some com a conta");
    await getAuthDb().delete(user).where(eq(user.id, id));
    expect(await withUserDb(id, (tx) => tx.select().from(catalogItems))).toHaveLength(0);
  });
});

describe("limite de 500 itens (RN-38)", () => {
  let userC = "";

  beforeAll(async () => {
    userC = await createAccount();
    await withUserDb(userC, (tx) =>
      tx.insert(catalogItems).values(
        Array.from({ length: MAX_CATALOG_ITEMS_PER_USER - 1 }, (_, index) => ({
          userId: userC,
          name: `Item ${index + 1}`,
        })),
      ),
    );
  });

  it("dois cadastros ao mesmo tempo no item 500: só um passa", async () => {
    const results = await Promise.all([
      saveCatalogItem(userC, null, { name: "Corrida 1", unit: "", unitPrice: "" }),
      saveCatalogItem(userC, null, { name: "Corrida 2", unit: "", unitPrice: "" }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["limit", "saved"]);
    expect(await listCatalogItems(userC)).toHaveLength(MAX_CATALOG_ITEMS_PER_USER);
  });

  it("o 501º é recusado com a mensagem clara, mesmo gravando direto no banco", async () => {
    expect(
      await saveCatalogItem(userC, null, { name: "Mais um", unit: "", unitPrice: "" }),
    ).toEqual({ status: "limit", message: CATALOG_LIMIT_MESSAGE });
    expect(
      await postgresErrorOf(
        withUserDb(userC, (tx) =>
          tx.insert(catalogItems).values({ userId: userC, name: "Direto" }),
        ),
      ),
    ).toMatch(/Limite de 500 itens/);
  });

  it("excluir um item libera a vaga", async () => {
    const [first] = await listCatalogItems(userC);
    await deleteCatalogItem(userC, first?.id ?? "");
    expect(
      (await saveCatalogItem(userC, null, { name: "Nova vaga", unit: "", unitPrice: "" })).status,
    ).toBe("saved");
  });
});
