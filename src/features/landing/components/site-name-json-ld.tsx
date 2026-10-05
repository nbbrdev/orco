import { headers } from "next/headers";

import { siteUrl } from "@/lib/site-url";

// Nome do site no resultado do Google (NBB-100 J1-A, J2-A): sem isto, o Google mostra o domínio
// ("nbbrdev.com"). Dados estruturados `WebSite` em JSON-LD, só na página inicial, como pede a
// documentação do Google. Texto fixo, sem dado de usuário; mesmo assim o `<` é escapado, como o guia
// de JSON-LD do Next recomenda. O navegador não executa o bloco; o nonce só evita aviso da CSP.

export async function SiteNameJsonLd() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Orçô",
    alternateName: "Orco",
    url: `${siteUrl()}/`,
  };

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
