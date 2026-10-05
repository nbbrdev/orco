import type { MetadataRoute } from "next";

import { getAppEnv } from "@/lib/app-env";
import { siteUrl } from "@/lib/site-url";

// robots.txt (NBB-59 L4-A): os buscadores só podem indexar a landing, o /experimentar (NBB-95 E6-A)
// e os documentos legais. O app,
// os orçamentos dos clientes (/p) e a API ficam de fora; o staging inteiro também (além do
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
      disallow: ["/app", "/p/", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
