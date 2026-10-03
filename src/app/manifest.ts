import type { MetadataRoute } from "next";

// Manifesto do PWA (RF-36, ADR-0009, NBB-60 W4): o que o celular usa ao instalar o Orçô na tela inicial.
// Servido em /manifest.webmanifest (liberado do Basic Auth no staging).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orçô",
    short_name: "Orçô",
    description: "Orçamentos simples para freelancers.",
    lang: "pt-BR",
    // Sem login, a página manda para o /entrar.
    start_url: "/app/orcamentos",
    display: "standalone",
    background_color: "#F6F8F8",
    theme_color: "#0F766E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
