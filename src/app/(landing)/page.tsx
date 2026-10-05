import { BellRing, FileText, Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoIcon } from "@/components/brand/logo-icon";
import { Button } from "@/components/ui/button";
import { AFTER_CONFIRM_PATH } from "@/features/auth/sign-up";
import { LegalLinks } from "@/features/legal/components/legal-page";
import { getSessionUser } from "@/lib/auth/session";

// Versão no ar: tag vX.Y.Z em produção, staging-<commit> no staging, "dev" localmente (ADR-0010).
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

// Prévia do link da landing (L3-B); a imagem vem do ./opengraph-image.tsx. Só aqui, e não no layout,
// para o link do orçamento do cliente (/p/[token]) não aparecer com a propaganda do Orçô.
export const metadata: Metadata = {
  openGraph: {
    siteName: "Orçô",
    locale: "pt_BR",
    type: "website",
    title: "Orçô: orçamentos simples para freelancers",
    description:
      "Crie um orçamento em menos de 2 minutos, envie por link ou PDF e receba a aprovação do cliente com um toque.",
  },
};

const BENEFITS = [
  { icon: Link2, text: "Um link para o cliente ver, aprovar ou recusar, sem criar conta." },
  { icon: FileText, text: "PDF com o seu logo e os seus dados." },
  { icon: BellRing, text: "Aviso por e-mail e no celular quando o cliente responde." },
];

// Landing (NBB-59 L1-A): uma tela, com a proposta, 3 benefícios e o caminho para o cadastro (F-01).
// A imagem de prévia do link fica em ./opengraph-image.tsx, só para esta página (L3-B).
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { conta } = await searchParams;

  // L2-A: quem já está logado vai direto para o app, como no /entrar e no /cadastro.
  if (await getSessionUser()) {
    redirect(AFTER_CONFIRM_PATH);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-12">
      {conta === "excluida" ? (
        // F-17 (NBB-43 E3): depois de excluir a conta.
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
          Sua conta foi excluída. Todos os seus dados foram apagados.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <LogoIcon className="size-12" />
        <span className="text-3xl font-bold tracking-tight">Orçô</span>
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-balance">
          Orçamentos simples para freelancers.
        </h1>
        <p className="text-muted-foreground">
          Crie um orçamento em menos de 2 minutos, envie por link ou PDF e receba a aprovação do
          cliente com um toque. Grátis.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:px-6">
          <Link href="/cadastro">Começar grátis</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="sm:px-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <LegalLinks />
        <span className="text-xs">{APP_VERSION}</span>
      </footer>
    </main>
  );
}
