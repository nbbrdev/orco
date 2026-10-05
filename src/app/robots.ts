import type { MetadataRoute } from "next";

import { getAppEnv } from "@/lib/app-env";
import { siteUrl } from "@/lib/site-url";

// robots.txt (NBB-59 L4-A): os buscadores só podem indexar a landing, o /experimentar (NBB-95 E6-A)
// e os documentos legais. O que não está em `disallow` fica liberado (os `allow` sozinhos não fecham
// nada), então as telas de conta, o app, os orçamentos dos clientes (/p) e a API são bloqueados um a
// um (NBB-99 I1-A). Não usamos `Disallow: /`: ele bloquearia também o CSS e o JavaScript (/_next/),
// que o Google usa para ler a página, e a imagem de prévia. O staging inteiro fica de fora (além do
// X-Robots-Tag e do Basic Auth). Lido na hora, e não no build, porque depende do .env do ambiente.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (getAppEnv() === "staging") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/experimentar", "/termos", "/privacidade"],
      disallow: [
        "/app",
        "/p/",
        "/api/",
        "/entrar",
        "/cadastro",
        "/recuperar-senha",
        "/redefinir-senha",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
