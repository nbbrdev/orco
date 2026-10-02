"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoIcon } from "@/components/brand/logo-icon";
import { buttonVariants } from "@/components/ui/button";
import { isActive, NAV_ITEMS, NEW_QUOTE_HREF } from "@/features/app-shell/nav-items";
import { cn } from "@/lib/utils";

// Barras de navegação do app logado (NBB-41, N2):
// - celular: barra inferior fixa com os 4 itens e o botão flutuante "+ Novo orçamento";
// - a partir de `md`: barra no topo com o logo, os 4 itens e o botão "+ Novo orçamento".
// O item da página atual fica com a cor da marca (N5).

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
            const active = isActive(pathname, href) && !isActive(pathname, NEW_QUOTE_HREF);
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
        <Link href={NEW_QUOTE_HREF} className={buttonVariants()}>
          <Plus aria-hidden="true" />
          Novo orçamento
        </Link>
      </div>
    </header>
  );
}

export function AppBottomBar() {
  const pathname = usePathname();

  return (
    <>
      <Link
        href={NEW_QUOTE_HREF}
        aria-label="Novo orçamento"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
      >
        <Plus className="size-6" aria-hidden="true" />
      </Link>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-16 grid-cols-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href) && !isActive(pathname, NEW_QUOTE_HREF);
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
