"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import {
  type ClientQuote,
  createClientForQuote,
  type CreateClientResult,
  createQuote,
  listClientQuotes,
  MONTHLY_LIMIT_MESSAGE,
  saveItemToCatalog,
  saveQuoteItems,
  type SaveItemsResult,
  type SaveToCatalogResult,
  setQuoteClient,
  type SetClientResult,
  updateCatalogItemDrafts,
  updateClientDrafts,
} from "@/features/quotes/quotes";
import { listQuotes, markResponseSeen, type QuotePage } from "@/features/quotes/list";
import { deleteQuote, duplicateQuote, type DuplicateQuoteResult } from "@/features/quotes/manage";
import { parseListFilters } from "@/features/quotes/list-filters";
import { requireSessionUser } from "@/lib/auth/session";

// Server Actions do editor e da lista de orçamentos (F-05, F-09): casca fina sobre
// src/features/quotes/quotes.ts e list.ts. O usuário vem da sessão validada no servidor, nunca do navegador.

/**
 * "Novo orçamento" (P1-A): só um toque de verdade cria o rascunho, nunca o pré-carregamento de um
 * link. No limite do mês, volta para a lista com o aviso.
 */
export async function createQuoteAction(): Promise<void> {
  const user = await requireSessionUser();
  const result = await createQuote(user.id);
  redirect(
    result.status === "created"
      ? `/app/orcamentos/${result.id}`
      : "/app/orcamentos?aviso=limite-mensal",
  );
}

/** "Novo orçamento para este cliente" (NBB-87 D2-A): o rascunho já nasce com o cliente. */
export async function createQuoteForClientAction(clientId: string): Promise<void> {
  const user = await requireSessionUser();
  const result = await createQuote(user.id, clientId);
  redirect(
    result.status === "created"
      ? `/app/orcamentos/${result.id}`
      : "/app/orcamentos?aviso=limite-mensal",
  );
}

/**
 * "Duplicar" (F-12, NBB-49 P2-A): abre o editor do rascunho novo. No limite do mês, fica no editor
 * com a mensagem (P3).
 */
export async function duplicateQuoteAction(id: string): Promise<{ message: string }> {
  const user = await requireSessionUser();
  let result: DuplicateQuoteResult;
  try {
    result = await duplicateQuote(user.id, id);
  } catch (error) {
    console.error("Falha ao duplicar o orçamento.", error);
    return { message: "Não foi possível duplicar. Tente de novo." };
  }
  if (result.status === "limit") {
    return { message: MONTHLY_LIMIT_MESSAGE };
  }
  if (result.status === "not_found") {
    return { message: "Este orçamento não existe mais." };
  }
  redirect(`/app/orcamentos/${result.id}`);
}

/** "Excluir" (F-13, RN-29, NBB-49 P4-A): volta para a lista. */
export async function deleteQuoteAction(id: string): Promise<{ message: string }> {
  const user = await requireSessionUser();
  try {
    await deleteQuote(user.id, id);
  } catch (error) {
    console.error("Falha ao excluir o orçamento.", error);
    return { message: "Não foi possível excluir. Tente de novo." };
  }
  redirect("/app/orcamentos");
}

/** Orçamentos do cliente, para o painel dele (RF-13, D1-A). */
export async function listClientQuotesAction(clientId: string): Promise<ClientQuote[] | null> {
  const user = await requireSessionUser();
  try {
    return await listClientQuotes(user.id, clientId);
  } catch (error) {
    console.error("Falha ao listar os orçamentos do cliente.", error);
    return null;
  }
}

const listFiltersInput = z.object({ tab: z.string().max(20), search: z.string().max(200) });

/** "Mostrar mais" na lista (NBB-48 L1-A): os próximos orçamentos da mesma aba e busca. */
export async function listQuotesAction(
  filters: unknown,
  offset: number,
): Promise<QuotePage | null> {
  const user = await requireSessionUser();
  const input = listFiltersInput.safeParse(filters);
  if (!input.success) {
    return null;
  }
  try {
    return await listQuotes(
      user.id,
      parseListFilters({ status: input.data.tab, busca: input.data.search }),
      offset,
    );
  } catch (error) {
    console.error("Falha ao listar os orçamentos.", error);
    return null;
  }
}

/** Ao abrir um orçamento respondido, o selo "novo" some da lista (RN-42, NBB-48 L4-A). */
export async function markResponseSeenAction(id: string): Promise<void> {
  const user = await requireSessionUser();
  try {
    await markResponseSeen(user.id, id);
  } catch (error) {
    console.error("Falha ao marcar a resposta como vista.", error);
  }
}

/** "Atualizar também os N rascunhos deste cliente?" → Atualizar (RN-20, D3-A). */
export async function updateClientDraftsAction(clientId: string): Promise<boolean> {
  const user = await requireSessionUser();
  try {
    await updateClientDrafts(user.id, clientId);
    return true;
  } catch (error) {
    console.error("Falha ao atualizar os rascunhos do cliente.", error);
    return false;
  }
}

/** "Atualizar também os N rascunhos que usam este item?" → Atualizar (RN-11, D4-A). */
export async function updateCatalogItemDraftsAction(itemId: string): Promise<boolean> {
  const user = await requireSessionUser();
  try {
    await updateCatalogItemDrafts(user.id, itemId);
    return true;
  } catch (error) {
    console.error("Falha ao atualizar os rascunhos do item do catálogo.", error);
    return false;
  }
}

export type SaveItemsState = SaveItemsResult | { status: "error" };

/** Salvamento automático do editor (P2-A, RN-21). */
export async function saveQuoteItemsAction(id: string, input: unknown): Promise<SaveItemsState> {
  const user = await requireSessionUser();
  try {
    return await saveQuoteItems(user.id, id, input);
  } catch (error) {
    console.error("Falha ao salvar o orçamento.", error);
    return { status: "error" };
  }
}

const ERROR = { status: "error" as const, message: "Não foi possível salvar. Tente de novo." };

/** Escolhe (ou tira, com `clientId` nulo) o cliente do orçamento (NBB-87 C2-A). */
export async function setQuoteClientAction(
  id: string,
  clientId: string | null,
): Promise<SetClientResult | typeof ERROR> {
  const user = await requireSessionUser();
  try {
    return await setQuoteClient(user.id, id, clientId);
  } catch (error) {
    console.error("Falha ao escolher o cliente do orçamento.", error);
    return ERROR;
  }
}

/** "Criar 'Fulano'" no editor (C4-A, RF-12). */
export async function createClientForQuoteAction(
  id: string,
  name: string,
): Promise<CreateClientResult | typeof ERROR> {
  const user = await requireSessionUser();
  try {
    return await createClientForQuote(user.id, id, z.string().parse(name));
  } catch (error) {
    console.error("Falha ao criar o cliente pelo orçamento.", error);
    return ERROR;
  }
}

const catalogDraft = z.object({
  description: z.string().max(5000),
  unit: z.string().max(50),
  unitPrice: z.string().max(50),
});

/** "Salvar no catálogo" no menu do item (C7-B). */
export async function saveItemToCatalogAction(
  input: unknown,
): Promise<SaveToCatalogResult | typeof ERROR> {
  const user = await requireSessionUser();
  const parsed = catalogDraft.safeParse(input);
  if (!parsed.success) {
    return ERROR;
  }
  try {
    return await saveItemToCatalog(user.id, parsed.data);
  } catch (error) {
    console.error("Falha ao salvar o item no catálogo.", error);
    return ERROR;
  }
}
