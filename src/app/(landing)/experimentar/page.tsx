import type { Metadata } from "next";

import { DemoQuote } from "@/features/demo/components/demo-quote";
import { SiteFooter, SiteHeader } from "@/features/landing/components/site-chrome";

export const metadata: Metadata = {
  title: "Experimente sem criar conta",
  description:
    "Monte um orçamento de exemplo e veja como o seu cliente recebe. Sem cadastro e sem guardar nada.",
  // Canônico (NBB-99 I3-A): o endereço único desta página para os buscadores.
  alternates: { canonical: "/experimentar" },
};

// Experimentar sem conta (NBB-95, D2-A): página pública, aberta também a quem está logado. Fica no
// grupo (landing), então o link compartilhado leva a mesma prévia da landing.
export default function TryItPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 pb-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-balance sm:text-3xl">
            Experimente o Orçô sem criar conta
          </h1>
          <p className="text-muted-foreground">
            Monte um orçamento de exemplo e veja como o seu cliente recebe. Nada é guardado.
          </p>
        </div>
        <DemoQuote />
      </main>
      <SiteFooter />
    </div>
  );
}
