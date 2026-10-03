import "server-only";

// Códigos de erro (SQLSTATE) que o app trata: os do Postgres e os próprios do Orçô, lançados pelos
// triggers de limite (RN-38).
export const DB_ERROR_CODES = {
  /** FK impediu a operação (ex.: excluir cliente com orçamentos, RN-09). */
  foreignKeyViolation: "23503",
  /** app.enforce_client_limit (migration 0004). */
  clientLimit: "OR001",
  /** app.enforce_catalog_item_limit (migration 0005). */
  catalogItemLimit: "OR002",
  /** 200 orçamentos criados no mês (RN-38), app.prepare_new_quote (migration 0007). */
  monthlyQuoteLimit: "OR003",
  /** 100 itens por orçamento (RN-14), app.check_quote_item_change (migration 0007). */
  quoteItemLimit: "OR004",
  /** Mudança de status fora das regras (RN-22 a RN-27), app.check_quote_update (migration 0007). */
  invalidStatusChange: "OR005",
  /** Orçamento respondido não muda (RN-25), migration 0007. */
  quoteLocked: "OR006",
  /** Envio sem os itens completos (RN-13), app.check_quote_update (migration 0007). */
  quoteNotReadyToSend: "OR007",
} as const;

/** Se o erro veio do Postgres com este código. O Drizzle embrulha o erro; o código fica em `cause`. */
export function hasPostgresCode(error: unknown, code: string): boolean {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}
