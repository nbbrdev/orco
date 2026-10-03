"use server";

import {
  deleteClient,
  type DeleteClientResult,
  saveClient,
  type SaveClientResult,
} from "@/features/clients/clients";
import { countClientDrafts } from "@/features/quotes/quotes";
import { requireSessionUser } from "@/lib/auth/session";

// Server Actions dos clientes (F-15, NBB-44): casca fina sobre src/features/clients/clients.ts. O
// usuário vem da sessão validada no servidor, nunca do navegador.

export type SaveClientState =
  | Exclude<SaveClientResult, { status: "saved" }>
  | (Extract<SaveClientResult, { status: "saved" }> & { drafts: number })
  | { status: "error"; message: string };

/**
 * Cria (`id` nulo) ou atualiza um cliente com o que foi digitado no painel (K6-A). Na edição, diz
 * quantos rascunhos usam o cliente, para a pergunta da RN-20 (NBB-87 D3-A).
 */
export async function saveClientAction(
  id: string | null,
  input: unknown,
): Promise<SaveClientState> {
  const user = await requireSessionUser();
  try {
    const result = await saveClient(user.id, id, input);
    if (result.status !== "saved") {
      return result;
    }
    const drafts = id === null ? 0 : await countClientDrafts(user.id, result.client.id);
    return { ...result, drafts };
  } catch (error) {
    console.error("Falha ao salvar o cliente.", error);
    return { status: "error", message: "Não foi possível salvar. Tente de novo." };
  }
}

export type DeleteClientState = DeleteClientResult | { status: "error"; message: string };

export async function deleteClientAction(id: string): Promise<DeleteClientState> {
  const user = await requireSessionUser();
  try {
    return await deleteClient(user.id, id);
  } catch (error) {
    console.error("Falha ao excluir o cliente.", error);
    return { status: "error", message: "Não foi possível excluir. Tente de novo." };
  }
}
