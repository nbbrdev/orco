import type { Metadata } from "next";

import { ComingSoon } from "@/features/app-shell/components/coming-soon";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orçamentos" };

// Página PROVISÓRIA (NBB-39, D1): a lista de orçamentos chega na M4. Por enquanto só prova que o
// login funcionou.
export default async function QuotesPage({ searchParams }: PageProps<"/app/orcamentos">) {
  // O link de confirmação vencido ou já usado também volta para cá, com `?error=…`: sem sessão, a
  // pessoa vai para o /entrar com o aviso (F-01).
  const { error } = await searchParams;
  const user = await requireSessionUser(error ? "/entrar?aviso=link-invalido" : undefined);

  return (
    <ComingSoon title={`Você entrou como ${user.email}`}>
      <p className="text-muted-foreground">A sua lista de orçamentos aparece aqui.</p>
    </ComingSoon>
  );
}
