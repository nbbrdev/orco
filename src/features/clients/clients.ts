import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  type ClientField,
  type ClientRow,
  clientSchema,
  type ClientValues,
} from "@/features/clients/schemas";
import { withUserDb } from "@/lib/db";
import { clients, MAX_CLIENTS_PER_USER } from "@/lib/db/schema";

// O "miolo" dos clientes (F-15, NBB-44), sem nada do Next: lê e grava sempre pelo withUserDb, então
// a RLS garante que cada pessoa só alcança os próprios clientes. O `userId` vem da sessão validada.

export const CLIENT_LIMIT_MESSAGE = `Você chegou ao limite de ${MAX_CLIENTS_PER_USER.toLocaleString("pt-BR")} clientes. Exclua um cliente que não usa mais para cadastrar outro.`;

/** Código do erro lançado pelo trigger app.enforce_client_limit (migration 0004). */
const CLIENT_LIMIT_ERROR_CODE = "OR001";

const clientId = z.uuid();

const columns = {
  id: clients.id,
  name: clients.name,
  email: clients.email,
  phone: clients.phone,
  document: clients.document,
  address: clients.address,
  internalNotes: clients.internalNotes,
};

/** Todos os clientes da pessoa, em ordem alfabética (K4-A: a busca filtra no navegador). */
export async function listClients(userId: string): Promise<ClientRow[]> {
  return withUserDb(userId, (tx) =>
    tx.select(columns).from(clients).orderBy(asc(clients.name), asc(clients.createdAt)),
  );
}

export type SaveClientResult =
  | { status: "saved"; client: ClientRow }
  | { status: "invalid"; errors: Partial<Record<ClientField, string>> }
  | { status: "limit"; message: string }
  | { status: "not_found" };

/**
 * Cria (sem `id`) ou atualiza um cliente. Devolve o cliente como ficou salvo (já limpo) ou o que
 * impediu: campos inválidos, o limite de 1.000 (RN-38) ou um cliente que não existe mais.
 */
export async function saveClient(
  userId: string,
  id: string | null,
  input: unknown,
): Promise<SaveClientResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid", errors: fieldErrors(parsed.error) };
  }
  if (id === null) {
    return createClient(userId, parsed.data);
  }
  if (!clientId.safeParse(id).success) {
    return { status: "not_found" };
  }
  const [updated] = await withUserDb(userId, (tx) =>
    tx
      .update(clients)
      .set(parsed.data)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning(columns),
  );
  return updated ? { status: "saved", client: updated } : { status: "not_found" };
}

async function createClient(userId: string, values: ClientValues): Promise<SaveClientResult> {
  try {
    const [created] = await withUserDb(userId, (tx) =>
      tx
        .insert(clients)
        .values({ ...values, userId })
        .returning(columns),
    );
    if (!created) {
      throw new Error("O insert do cliente não devolveu a linha.");
    }
    return { status: "saved", client: created };
  } catch (error) {
    if (isClientLimitError(error)) {
      return { status: "limit", message: CLIENT_LIMIT_MESSAGE };
    }
    throw error;
  }
}

/** Exclui um cliente da pessoa. Sem orçamentos ainda (M4), a exclusão sempre é permitida (K1-A). */
export async function deleteClient(
  userId: string,
  id: string,
): Promise<{ status: "deleted" | "not_found" }> {
  if (!clientId.safeParse(id).success) {
    return { status: "not_found" };
  }
  const deleted = await withUserDb(userId, (tx) =>
    tx
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning({ id: clients.id }),
  );
  return { status: deleted.length > 0 ? "deleted" : "not_found" };
}

/** A primeira mensagem de erro de cada campo. */
function fieldErrors(error: z.ZodError): Partial<Record<ClientField, string>> {
  const errors: Partial<Record<ClientField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ClientField | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

// O Drizzle embrulha o erro do Postgres; o código (SQLSTATE) fica em `cause`.
function isClientLimitError(error: unknown): boolean {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === CLIENT_LIMIT_ERROR_CODE
  );
}
