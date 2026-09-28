import { NextResponse, type NextRequest } from "next/server";

import { getAppEnv } from "@/lib/app-env";
import { isAuthorized, isPublicPath } from "@/lib/basic-auth";
import { updateSession } from "@/lib/supabase/proxy";

// Buscadores não devem indexar o staging.
const NOINDEX = "noindex, nofollow";

// Proxy do Next 16 (antigo middleware.ts): roda antes de cada rota que casa com o matcher.
export async function proxy(request: NextRequest) {
  const isStaging = getAppEnv() === "staging";

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

  const response = await updateSession(request);
  if (isStaging) {
    response.headers.set("X-Robots-Tag", NOINDEX);
  }
  return response;
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos e de otimização de imagem do Next, favicon/ícones e imagens.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
