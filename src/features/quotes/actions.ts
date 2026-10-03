"use server";

import { redirect } from "next/navigation";

import { createQuote, saveQuoteItems, type SaveItemsResult } from "@/features/quotes/quotes";
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
