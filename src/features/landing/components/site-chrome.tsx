import Link from "next/link";

import { LogoIcon } from "@/components/brand/logo-icon";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/features/legal/components/legal-page";

// Cabeçalho e rodapé das páginas de apresentação (landing e /experimentar, NBB-97 e NBB-95).

// Versão no ar: tag vX.Y.Z em produção, staging-<commit> no staging, "dev" localmente (ADR-0010).
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
      <Link href="/" className="flex items-center gap-2" aria-label="Orçô, página inicial">
        <LogoIcon className="size-9" />
        <span className="text-xl font-bold tracking-tight">Orçô</span>
      </Link>
      <Button asChild variant="ghost">
        <Link href="/entrar">Entrar</Link>
      </Button>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-6 text-sm text-muted-foreground">
      <LegalLinks />
      <span className="text-xs">{APP_VERSION}</span>
    </footer>
  );
}

/** "Começar grátis" e "Experimentar sem conta" (E7-A): no topo e na chamada final da landing. */
export function SignUpButtons({ className }: { className?: string }) {
  return (
    <div className={className ?? "flex flex-col gap-3 sm:flex-row"}>
      <Button asChild size="lg" className="sm:px-8">
        <Link href="/cadastro">Começar grátis</Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="sm:px-8">
        <Link href="/experimentar">Experimentar sem conta</Link>
      </Button>
    </div>
  );
}
