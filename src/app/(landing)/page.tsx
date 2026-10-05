import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AFTER_CONFIRM_PATH } from "@/features/auth/sign-up";
import {
  BenefitsSection,
  ClientPreviewSection,
  FaqSection,
  FinalCallSection,
  HowItWorksSection,
  ProblemSection,
} from "@/features/landing/components/landing-sections";
import { SignUpButtons, SiteFooter, SiteHeader } from "@/features/landing/components/site-chrome";
import { getSessionUser } from "@/lib/auth/session";

// Prévia do link da landing (NBB-59 L3-B); a imagem vem do ./opengraph-image.tsx. Só aqui, e não no
// layout, para o link do orçamento do cliente (/p/[token]) não aparecer com a propaganda do Orçô.
export const metadata: Metadata = {
  openGraph: {
    siteName: "Orçô",
    locale: "pt_BR",
    type: "website",
    title: "Orçô: seus serviços, preços e clientes num só lugar",
    description:
      "Organize os seus serviços e valores, monte um orçamento com a sua marca e mande um link para o cliente aprovar com um toque. Grátis.",
  },
};

// Landing (NBB-97): focada no problema do freelancer (D6), com as seções de
// features/landing/components/landing-sections.tsx e o "Experimentar sem conta" (NBB-95 E7-A).
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { conta } = await searchParams;

  // NBB-59 L2-A: quem já está logado vai direto para o app, como no /entrar e no /cadastro.
  if (await getSessionUser()) {
    redirect(AFTER_CONFIRM_PATH);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex flex-col">
        {conta === "excluida" ? (
          // F-17 (NBB-43 E3): depois de excluir a conta.
          <p
            role="status"
            className="mx-4 rounded-lg border border-border bg-muted p-3 text-sm sm:mx-auto sm:w-full sm:max-w-5xl"
          >
            Sua conta foi excluída. Todos os seus dados foram apagados.
          </p>
        ) : null}

        {/* Topo (D6.1-A). */}
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-10 pb-6 sm:pt-16">
          <h1 className="max-w-3xl text-3xl font-semibold text-balance sm:text-5xl">
            Seus serviços, preços e clientes num só lugar. Orçamentos bonitos em 2 minutos.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Organize os seus serviços e valores, monte um orçamento com a sua marca e mande um link
            para o cliente aprovar com um toque. Grátis.
          </p>
          <SignUpButtons />
        </section>

        <ProblemSection />
        <HowItWorksSection />
        <ClientPreviewSection />
        <BenefitsSection />
        <FaqSection />
        <FinalCallSection />
      </main>

      <SiteFooter />
    </div>
  );
}
