import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  type CatalogItemField,
  type CatalogItemRow,
  catalogItemSchema,
} from "@/features/catalog/schemas";
import { withUserDb } from "@/lib/db";
import { DB_ERROR_CODES, hasPostgresCode } from "@/lib/db/errors";
import { catalogItems, MAX_CATALOG_ITEMS_PER_USER } from "@/lib/db/schema";
import { firstErrorByField } from "@/lib/validation";

// O "miolo" do catálogo (F-16, NBB-45), no mesmo padrão dos clientes: lê e grava sempre pelo
// withUserDb, então a RLS garante que cada pessoa só alcança os próprios itens. O `userId` vem da
// sessão validada.

export const CATALOG_LIMIT_MESSAGE = `Você chegou ao limite de ${MAX_CATALOG_ITEMS_PER_USER} itens no catálogo. Exclua um item que não usa mais para cadastrar outro.`;

const itemId = z.uuid();

const columns = {
  id: catalogItems.id,
  name: catalogItems.name,
  unit: catalogItems.unit,
  unitPriceCents: catalogItems.unitPriceCents,
};

/** Todos os itens da pessoa, em ordem alfabética (a busca filtra no navegador). */
export async function listCatalogItems(userId: string): Promise<CatalogItemRow[]> {
  return withUserDb(userId, (tx) =>
    tx
      .select(columns)
      .from(catalogItems)
      .orderBy(asc(catalogItems.name), asc(catalogItems.createdAt)),
  );
}

export type SaveCatalogItemResult =
  | { status: "saved"; item: CatalogItemRow }
  | { status: "invalid"; errors: Partial<Record<CatalogItemField, string>> }
  | { status: "limit"; message: string }
  | { status: "not_found" };

/**
 * Cria (sem `id`) ou atualiza um item. Devolve o item como ficou salvo (preço em centavos) ou o que
 * impediu: campos inválidos, o limite de 500 (RN-38) ou um item que não existe mais.
 */
export async function saveCatalogItem(
  userId: string,
  id: string | null,
  input: unknown,
): Promise<SaveCatalogItemResult> {
  const parsed = catalogItemSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid", errors: firstErrorByField<CatalogItemField>(parsed.error) };
  }
  const values = {
    name: parsed.data.name,
    unit: parsed.data.unit,
    unitPriceCents: parsed.data.unitPrice,
  };

  if (id === null) {
    try {
      const [created] = await withUserDb(userId, (tx) =>
        tx
          .insert(catalogItems)
          .values({ ...values, userId })
          .returning(columns),
      );
      if (!created) {
        throw new Error("O insert do item não devolveu a linha.");
      }
      return { status: "saved", item: created };
    } catch (error) {
      if (hasPostgresCode(error, DB_ERROR_CODES.catalogItemLimit)) {
        return { status: "limit", message: CATALOG_LIMIT_MESSAGE };
      }
      throw error;
    }
  }

  if (!itemId.safeParse(id).success) {
    return { status: "not_found" };
  }
  const [updated] = await withUserDb(userId, (tx) =>
    tx
      .update(catalogItems)
      .set(values)
      .where(and(eq(catalogItems.id, id), eq(catalogItems.userId, userId)))
      .returning(columns),
  );
  return updated ? { status: "saved", item: updated } : { status: "not_found" };
}

/** Exclui um item da pessoa. Não afeta nenhum orçamento (RN-11). */
export async function deleteCatalogItem(
  userId: string,
  id: string,
): Promise<{ status: "deleted" | "not_found" }> {
  if (!itemId.safeParse(id).success) {
    return { status: "not_found" };
  }
  const deleted = await withUserDb(userId, (tx) =>
    tx
      .delete(catalogItems)
      .where(and(eq(catalogItems.id, id), eq(catalogItems.userId, userId)))
      .returning({ id: catalogItems.id }),
  );
  return { status: deleted.length > 0 ? "deleted" : "not_found" };
}
