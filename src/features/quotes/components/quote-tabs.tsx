import Link from "next/link";

import { listHref, QUOTE_TABS, type QuoteListFilters } from "@/features/quotes/list-filters";
import { cn } from "@/lib/utils";

// Abas por status (F-09, NBB-48 L3-A): links que mudam a URL e mantêm a busca. No celular, a fileira
// rola para o lado.

export function QuoteTabs({ filters }: { filters: QuoteListFilters }) {
  return (
    <nav aria-label="Filtrar por status" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1">
        {QUOTE_TABS.map(({ tab, label }) => {
          const current = tab === filters.tab;
          return (
            <li key={tab}>
              <Link
                href={listHref({ tab, search: filters.search })}
                aria-current={current ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
