import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Client do Supabase para Client Components. Usa a mesma sessão (cookies) do servidor,
 * com a chave publishable: tudo passa pela RLS. Nunca use dados daqui para autorizar.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
