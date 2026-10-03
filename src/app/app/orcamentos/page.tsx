import type { Metadata } from "next";

import { NewQuoteButton } from "@/features/quotes/components/new-quote-button";
import { QuoteList } from "@/features/quotes/components/quote-list";
import { QuoteSearch } from "@/features/quotes/components/quote-search";
import { QuoteTabs } from "@/features/quotes/components/quote-tabs";
import { listQuotes } from "@/features/quotes/list";
import { parseListFilters, QUOTE_TABS } from "@/features/quotes/list-filters";
import { MONTHLY_LIMIT_MESSAGE } from "@/features/quotes/quotes";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orçamentos" };

// Lista de orçamentos (F-09, NBB-48), a tela inicial do app. A aba e a busca vêm da URL (L1-A); o
// banco filtra e devolve os primeiros 50, da última atividade para trás (L2-A).
export default async function QuotesPage({ searchParams }: PageProps<"/app/orcamentos">) {
  // O link de confirmação vencido ou já usado também volta para cá, com `?error=…`: sem sessão, a
  // pessoa vai para o /entrar com o aviso (F-01).
  const params = await searchParams;
  const user = await requireSessionUser(params.error ? "/entrar?aviso=link-invalido" : undefined);
  const filters = parseListFilters(params);
  const page = await listQuotes(user.id, filters);
  const limitWarning =
    params.aviso === "limite-mensal" ? (
      <p role="alert" className="text-sm text-destructive">
        {MONTHLY_LIMIT_MESSAGE}
      </p>
    ) : null;

  // Conta sem nenhum orçamento: só o convite para criar o primeiro (L6).
  if (page.quotes.length === 0 && filters.tab === "todos" && !filters.search) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Orçamentos</h1>
        {limitWarning}
        <p className="text-muted-foreground">Você ainda não tem orçamentos</p>
        <div>
          <NewQuoteButton variant="large">Criar primeiro orçamento</NewQuoteButton>
        </div>
      </div>
    );
  }

  const empty = filters.search
    ? `Nenhum orçamento encontrado para "${filters.search}".`
    : QUOTE_TABS.find((entry) => entry.tab === filters.tab)?.empty;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Orçamentos</h1>
      {limitWarning}
      <QuoteSearch filters={filters} />
      <QuoteTabs filters={filters} />
      {page.quotes.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <QuoteList key={`${filters.tab}|${filters.search}`} filters={filters} initial={page} />
      )}
    </div>
  );
}
