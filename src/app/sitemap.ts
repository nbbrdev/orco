import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

// sitemap.xml (NBB-59 L4-A): só as páginas públicas que os buscadores podem indexar (robots.ts).
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["", "/experimentar", "/termos", "/privacidade"].map((path) => ({
    url: `${base}${path}`,
  }));
}
