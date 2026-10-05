import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";

import { ServiceWorker } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "Orçamentos simples para freelancers: crie, envie por link e receba a aprovação do cliente em minutos.";

// Lido a cada requisição (as páginas já são dinâmicas por causa do nonce): o metadataBase vem do
// SITE_URL do ambiente, que não existe no build da imagem Docker.
export function generateMetadata(): Metadata {
  return {
    // Base dos endereços absolutos da prévia do link (og:image, NBB-59 L3-B).
    metadataBase: new URL(siteUrl()),
    title: {
      default: "Orçô",
      template: "%s · Orçô",
    },
    description: DESCRIPTION,
    applicationName: "Orçô",
    // Ícone da tela inicial do iPhone (NBB-60). O favicon é o src/app/icon.svg; o manifesto fica em
    // src/app/manifest.ts.
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1413" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce da CSP desta requisição (gerado no proxy): libera o script inline do next-themes.
  // Ler headers() torna as páginas dinâmicas, o que o nonce exige (docs/07-seguranca.md §7).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning: o next-themes adiciona a classe do tema no <html> antes da hidratação.
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
