import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Proxy do Next 16 (antigo middleware.ts): roda antes de cada rota que casa com o matcher.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos e de otimização de imagem do Next, favicon/ícones e imagens.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
