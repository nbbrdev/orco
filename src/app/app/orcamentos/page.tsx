import type { Metadata } from "next";

import { MONTHLY_LIMIT_MESSAGE } from "@/features/quotes/quotes";
import { NewQuoteButton } from "@/features/quotes/components/new-quote-button";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orçamentos" };

// Página PROVISÓRIA (NBB-39, D1): a lista de orçamentos chega na NBB-48. Por enquanto, o botão para
// criar o primeiro (NBB-86 P1-A) e o aviso do limite do mês (RN-38).
export default async function QuotesPage({ searchParams }: PageProps<"/app/orcamentos">) {
  // O link de confirmação vencido ou já usado também volta para cá, com `?error=…`: sem sessão, a
  // pessoa vai para o /entrar com o aviso (F-01).
  const { error, aviso } = await searchParams;
  await requireSessionUser(error ? "/entrar?aviso=link-invalido" : undefined);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Orçamentos</h1>
      {aviso === "limite-mensal" ? (
        <p role="alert" className="text-sm text-destructive">
          {MONTHLY_LIMIT_MESSAGE}
        </p>
      ) : null}
      <p className="text-muted-foreground">A lista dos seus orçamentos aparece aqui em breve.</p>
      <div>
        <NewQuoteButton variant="large">Criar primeiro orçamento</NewQuoteButton>
      </div>
    </div>
  );
}
