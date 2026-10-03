"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { listHref, MAX_SEARCH_LENGTH, type QuoteListFilters } from "@/features/quotes/list-filters";

// Busca da lista (F-09, NBB-48 L1-A, L5-A): cliente ou número. Um instante depois da última tecla,
// troca a URL (sem criar uma entrada nova no histórico) e o servidor devolve a lista filtrada.

const SEARCH_DELAY_MS = 300;

export function QuoteSearch({ filters }: { filters: QuoteListFilters }) {
  const router = useRouter();
  const [term, setTerm] = useState(filters.search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function change(value: string) {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      router.replace(listHref({ tab: filters.tab, search: value.trim() }), { scroll: false });
    }, SEARCH_DELAY_MS);
  }

  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label="Buscar por cliente ou número"
        placeholder="Buscar por cliente ou número"
        maxLength={MAX_SEARCH_LENGTH}
        value={term}
        onChange={(event) => change(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}
