"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import {
  createClientForQuote,
  type CreateClientResult,
  createQuote,
  saveItemToCatalog,
  saveQuoteItems,
  type SaveItemsResult,
  type SaveToCatalogResult,
  setQuoteClient,
  type SetClientResult,
} from "@/features/quotes/quotes";
import { requireSessionUser } from "@/lib/auth/session";

// Server Actions do editor de orçamento (F-05, NBB-86): casca fina sobre
// src/features/quotes/quotes.ts. O usuário vem da sessão validada no servidor, nunca do navegador.

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
