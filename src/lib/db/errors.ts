import "server-only";

// Códigos de erro (SQLSTATE) próprios do Orçô, lançados pelos triggers de limite (RN-38).
export const DB_ERROR_CODES = {
  /** app.enforce_client_limit (migration 0004). */
  clientLimit: "OR001",
  /** app.enforce_catalog_item_limit (migration 0005). */
  catalogItemLimit: "OR002",
} as const;

/** Se o erro veio do Postgres com este código. O Drizzle embrulha o erro; o código fica em `cause`. */
export function hasPostgresCode(error: unknown, code: string): boolean {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}
