import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ComingSoon } from "@/features/app-shell/components/coming-soon";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orçamentos" };

// Página PROVISÓRIA (NBB-39, D1): a lista de orçamentos chega na M4. Por enquanto só prova que o
// login funcionou.
export default async function QuotesPage({ searchParams }: PageProps<"/app/orcamentos">) {
  // Aqui não dá para usar só o requireSessionUser(): o link de confirmação vencido ou já usado também
  // volta para cá, com `?error=…`, e precisa de outro aviso no /entrar (F-01).
  const user = await getSessionUser();
  if (!user) {
    const { error } = await searchParams;
    redirect(error ? "/entrar?aviso=link-invalido" : "/entrar");
  }

  return (
    <ComingSoon title={`Você entrou como ${user.email}`}>
      <p className="text-muted-foreground">A sua lista de orçamentos aparece aqui.</p>
    </ComingSoon>
  );
}
