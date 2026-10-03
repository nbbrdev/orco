"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoIcon } from "@/components/brand/logo-icon";
import { isActive, isQuoteEditor, NAV_ITEMS } from "@/features/app-shell/nav-items";
import { NewQuoteButton } from "@/features/quotes/components/new-quote-button";
import { cn } from "@/lib/utils";

// Barras de navegação do app logado (NBB-41, N2):
// - celular: barra inferior fixa com os 4 itens e o botão flutuante "+ Novo orçamento";
// - a partir de `md`: barra no topo com o logo, os 4 itens e o botão "+ Novo orçamento".
// O item da página atual fica com a cor da marca (N5). O "Novo orçamento" é um formulário, não um
// link (NBB-86 P1-A).

export function AppTopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background md:block">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
        <Link
          href="/app/orcamentos"
          className="flex items-center gap-2"
          aria-label="Orçô, orçamentos"
        >
          <LogoIcon className="size-7" />
          <span className="text-lg font-bold tracking-tight">Orçô</span>
        </Link>
        <nav aria-label="Principal" className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <NewQuoteButton />
      </div>
    </header>
  );
}

export function AppBottomBar() {
  const pathname = usePathname();

  return (
    <>
      {/* No editor, o rodapé com o total ocupa esse canto (NBB-86). */}
      {isQuoteEditor(pathname) ? null : <NewQuoteButton variant="fab" />}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-16 grid-cols-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
