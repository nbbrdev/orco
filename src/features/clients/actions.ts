"use server";

import {
  deleteClient,
  type DeleteClientResult,
  saveClient,
  type SaveClientResult,
} from "@/features/clients/clients";
import { requireSessionUser } from "@/lib/auth/session";

// Server Actions dos clientes (F-15, NBB-44): casca fina sobre src/features/clients/clients.ts. O
// usuário vem da sessão validada no servidor, nunca do navegador.

export type SaveClientState = SaveClientResult | { status: "error"; message: string };

/** Cria (`id` nulo) ou atualiza um cliente com o que foi digitado no painel (K6-A). */
export async function saveClientAction(
  id: string | null,
  input: unknown,
): Promise<SaveClientState> {
  const user = await requireSessionUser();
  try {
    return await saveClient(user.id, id, input);
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
