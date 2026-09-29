import { NextResponse, type NextRequest } from "next/server";

import { getAppEnv } from "@/lib/app-env";
import { isAuthorized, isPublicPath } from "@/lib/basic-auth";
import { buildCsp, createNonce } from "@/lib/security/csp";

// Buscadores não devem indexar o staging.
const NOINDEX = "noindex, nofollow";

// Proxy do Next 16 (antigo middleware.ts): roda antes de cada rota que casa com o matcher.
// A sessão de login (Better Auth, M2) é validada nas próprias rotas, no servidor, e não aqui.
export function proxy(request: NextRequest) {
  const appEnv = getAppEnv();
  const isStaging = appEnv === "staging";

  if (isStaging && !isPublicPath(request.nextUrl.pathname)) {
    const user = process.env.STAGING_BASIC_AUTH_USER;
    const password = process.env.STAGING_BASIC_AUTH_PASSWORD;

    // Sem credenciais configuradas, o staging fica fechado (nunca aberto por esquecimento).
    if (!user || !password) {
      return new NextResponse("Staging sem credenciais configuradas.", {
        status: 503,
        headers: { "X-Robots-Tag": NOINDEX },
      });
    }

    if (!isAuthorized(request.headers.get("authorization"), user, password)) {
      return new NextResponse("Autenticação necessária.", {
        status: 401,
        headers: {
          // Header HTTP: só ASCII no realm (acentos aparecem quebrados em alguns navegadores).
          "WWW-Authenticate": 'Basic realm="Orco staging", charset="UTF-8"',
          "X-Robots-Tag": NOINDEX,
        },
      });
    }
  }

  // CSP com nonce novo a cada requisição (docs/07-seguranca.md §7). Vai nos headers da REQUISIÇÃO,
  // de onde o Next extrai o nonce para marcar os próprios scripts, e nos da RESPOSTA, que o
  // navegador aplica.
  const nonce = createNonce();
  const csp = buildCsp({ nonce, appEnv });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (isStaging) {
    response.headers.set("X-Robots-Tag", NOINDEX);
  }
  return response;
}

export const config = {
  // Sem excluir prefetches (a doc do Next sugere): no staging, eles escapariam do Basic Auth.
  matcher: [
    // Tudo, exceto arquivos estáticos e de otimização de imagem do Next, favicon/ícones e imagens.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
