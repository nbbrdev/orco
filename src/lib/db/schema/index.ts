// Schema do banco em TypeScript (ADR-0014). As tabelas do produto chegam na M2 (profiles) em diante,
// sempre com RLS (ENABLE + FORCE), policies com `app.current_user_id()` e teste de integração.
// As tabelas de login do Better Auth (schema `auth`) ficam em ./auth.ts.
export * from "./auth";
export * from "./catalog-items";
export * from "./clients";
export * from "./profiles";
export * from "./quotes";
