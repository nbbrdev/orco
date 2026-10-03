"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { createQuoteForClientAction, listClientQuotesAction } from "@/features/quotes/actions";
import { formatQuoteNumber } from "@/features/quotes/items";
import type { ClientQuote } from "@/features/quotes/quotes";
import { formatBRL } from "@/lib/money";

import { StatusBadge } from "./status-badge";

// Orçamentos do cliente, no painel dele (F-15, RF-13, NBB-87 D1-A): do mais novo ao mais antigo, com
// o status e o total; tocar abre o editor. E o atalho "Novo orçamento para este cliente" (D2-A).

export function ClientQuotes({ clientId }: { clientId: string }) {
  // `undefined` enquanto carrega; `null` se não deu para carregar.
  const [quotes, setQuotes] = useState<ClientQuote[] | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void listClientQuotesAction(clientId).then((result) => {
      if (active) setQuotes(result);
    });
    return () => {
      active = false;
    };
  }, [clientId]);

  return (
    <section aria-labelledby="client-quotes-heading" className="flex flex-col gap-3">
      <h3 id="client-quotes-heading" className="text-sm font-medium">
        Orçamentos
      </h3>

      {quotes === undefined ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : quotes === null ? (
        <p className="text-sm text-destructive">Não foi possível carregar os orçamentos.</p>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum orçamento para este cliente ainda.</p>
      ) : (
        <ul aria-label="Orçamentos do cliente" className="flex flex-col divide-y rounded-lg border">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link
                href={`/app/orcamentos/${quote.id}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="font-medium">Nº {formatQuoteNumber(quote.number)}</span>
                <StatusBadge status={quote.status} />
                <span className="ml-auto tabular-nums">{formatBRL(quote.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={createQuoteForClientAction.bind(null, clientId)}>
        <NewQuoteForClientButton />
      </form>
    </section>
  );
}

function NewQuoteForClientButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <Plus aria-hidden="true" />
      Novo orçamento para este cliente
    </Button>
  );
}
