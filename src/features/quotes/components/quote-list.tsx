"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { listQuotesAction } from "@/features/quotes/actions";
import type { QuoteCard as QuoteCardData, QuotePage } from "@/features/quotes/list";
import type { QuoteListFilters } from "@/features/quotes/list-filters";

import { QuoteCard } from "./quote-card";

// Os cartões da lista e o "Mostrar mais" (F-09, NBB-48 L1-A). A primeira página vem do servidor, com
// a página; as seguintes, por Server Action. Trocar de aba ou de busca recria este componente.

export function QuoteList({ filters, initial }: { filters: QuoteListFilters; initial: QuotePage }) {
  const [quotes, setQuotes] = useState<QuoteCardData[]>(initial.quotes);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setLoading(true);
    setFailed(false);
    const next = await listQuotesAction(filters, quotes.length);
    setLoading(false);
    if (!next) {
      setFailed(true);
      return;
    }
    // Um orçamento editado em outra aba pode ter mudado de lugar: não repete o que já está na tela.
    setQuotes((current) => {
      const shown = new Set(current.map((quote) => quote.id));
      return [...current, ...next.quotes.filter((quote) => !shown.has(quote.id))];
    });
    setHasMore(next.hasMore);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Orçamentos" className="flex flex-col gap-2">
        {quotes.map((quote) => (
          <QuoteCard key={quote.id} quote={quote} />
        ))}
      </ul>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar mais orçamentos. Tente de novo.
        </p>
      ) : null}
      {hasMore ? (
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            {loading ? "Carregando…" : "Mostrar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
