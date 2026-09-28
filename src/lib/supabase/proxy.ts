import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Renova a sessão do Supabase a cada requisição (chamado por src/proxy.ts).
 *
 * O access token (JWT) expira em pouco tempo; aqui o refresh token troca por um novo e os
 * cookies atualizados vão tanto para a requisição (lida pelos Server Components) quanto para
 * a resposta (gravada no navegador).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Respostas que gravam cookies de sessão não podem ser cacheadas por CDN/proxy,
        // senão o token de um usuário poderia ser servido a outro.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Não coloque código entre a criação do client e esta chamada: é ela que valida o JWT e,
  // se preciso, renova a sessão antes de a resposta ser gerada.
  await supabase.auth.getClaims();

  return response;
}
