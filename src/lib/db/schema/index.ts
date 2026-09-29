// Schema do banco em TypeScript (ADR-0014). As tabelas do produto chegam na M2 (profiles) em diante,
// sempre com RLS (ENABLE + FORCE), policies com `app.current_user_id()` e teste de integração.
// As tabelas do Better Auth (schema `auth`) chegam na NBB-39.
export {};
