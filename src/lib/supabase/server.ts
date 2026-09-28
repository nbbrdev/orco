import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Client do Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do usuário (cookies), então todas as consultas passam pela RLS.
 *
 * Crie um client novo a cada requisição: nunca guarde em variável de módulo.
 * Para autorizar, use `supabase.auth.getClaims()` ou `getUser()`, nunca `getSession()`
 * (docs/07-seguranca.md §2).
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies durante a renderização.
          // Pode ignorar: o proxy (src/proxy.ts) já renova a sessão a cada requisição.
        }
      },
    },
  });
}
