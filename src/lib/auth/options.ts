import type { BetterAuthOptions } from "better-auth";

// Opções do Better Auth que desenham as tabelas e as regras da conta (ADR-0013, NBB-79). Usadas pelo
// app (getAuth, em ./index.ts) e pelo CLI que gera o schema (auth.config.ts, na raiz), para os dois
// nunca divergirem. Sem segredos nem banco: este arquivo não lê o .env, por isso não tem
// `server-only` (o CLI roda fora do Next).
export const authOptions = {
  advanced: {
    // IDs em UUID, gerados pelo Postgres: o withUserDb e a app.current_user_id() da RLS esperam uuid.
    database: { generateId: "uuid" },
  },
  emailAndPassword: {
    enabled: true,
    // RN-03: mínimo de 8 caracteres, sem exigência de tipos.
    minPasswordLength: 8,
    // RN-02: o e-mail precisa ser confirmado antes do primeiro acesso (envio na NBB-80/NBB-39).
    requireEmailVerification: true,
  },
  // Nenhum dado de uso sai do servidor (já é o padrão; explícito para não mudar numa atualização).
  telemetry: { enabled: false },
} satisfies BetterAuthOptions;
