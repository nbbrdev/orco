import Link from "next/link";

import { formatQuoteNumber } from "@/features/quotes/items";
import type { QuoteCard as QuoteCardData } from "@/features/quotes/list";
import { formatDateBR, todayInAppTimeZone } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

import { StatusBadge } from "./status-badge";

// Um orçamento na lista (F-09, NBB-48 L4-A): número, cliente, total, status, o selo "novo" (RN-42) e
// "Visualizado em dd/mm" (RN-35). Tocar abre o editor.

/** O dia (em São Paulo) de um instante: "03/10". */
function dayMonth(instant: string): string {
  return formatDateBR(todayInAppTimeZone(new Date(instant))).slice(0, 5);
}

export function QuoteCard({ quote }: { quote: QuoteCardData }) {
  return (
    <li>
      <Link
        href={`/app/orcamentos/${quote.id}`}
        className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            <span className="font-medium">Nº {formatQuoteNumber(quote.number)}</span>
            <span className="text-muted-foreground"> · </span>
            {quote.clientName ?? <span className="text-muted-foreground">Sem cliente</span>}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatBRL(quote.totalCents)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={quote.status} />
          {quote.isNew ? (
            <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Novo
            </span>
          ) : null}
          {quote.viewedAt ? (
            <span className="text-xs text-muted-foreground">
              Visualizado em {dayMonth(quote.viewedAt)}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
