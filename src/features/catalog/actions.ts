"use server";

import {
  deleteCatalogItem,
  saveCatalogItem,
  type SaveCatalogItemResult,
} from "@/features/catalog/catalog";
import { requireSessionUser } from "@/lib/auth/session";

// Server Actions do catálogo (F-16, NBB-45): casca fina sobre src/features/catalog/catalog.ts. O
// usuário vem da sessão validada no servidor, nunca do navegador.

export type SaveCatalogItemState = SaveCatalogItemResult | { status: "error"; message: string };

/** Cria (`id` nulo) ou atualiza um item com o que foi digitado no painel. */
export async function saveCatalogItemAction(
  id: string | null,
  input: unknown,
): Promise<SaveCatalogItemState> {
  const user = await requireSessionUser();
  try {
    return await saveCatalogItem(user.id, id, input);
  } catch (error) {
    console.error("Falha ao salvar o item do catálogo.", error);
    return { status: "error", message: "Não foi possível salvar. Tente de novo." };
  }
}

export type DeleteCatalogItemState =
  { status: "deleted" | "not_found" } | { status: "error"; message: string };

export async function deleteCatalogItemAction(id: string): Promise<DeleteCatalogItemState> {
  const user = await requireSessionUser();
  try {
    return await deleteCatalogItem(user.id, id);
  } catch (error) {
    console.error("Falha ao excluir o item do catálogo.", error);
    return { status: "error", message: "Não foi possível excluir. Tente de novo." };
  }
}
