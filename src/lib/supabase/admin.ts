import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Client com a chave service_role: IGNORA a RLS. Único arquivo do projeto que a lê.
 *
 * Uso permitido (docs/07-seguranca.md §4): página e PDF públicos do orçamento (via RPCs
 * SECURITY DEFINER), cron de lembretes e exclusão de conta. O ESLint bloqueia a importação
 * em qualquer outro lugar; `server-only` quebra o build se ele chegar ao navegador.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Defina SUPABASE_SERVICE_ROLE_KEY (veja .env.example).");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
