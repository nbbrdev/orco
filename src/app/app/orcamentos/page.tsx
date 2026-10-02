import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoIcon } from "@/components/brand/logo-icon";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orçamentos" };

// Página PROVISÓRIA (NBB-39, D1): a lista de orçamentos chega na M4. Por enquanto só prova que o
// login funcionou. A proteção de todo o /app e o logout vêm na NBB-41.
export default async function QuotesPage({ searchParams }: PageProps<"/app/orcamentos">) {
  const user = await getSessionUser();
  if (!user) {
    // Link de confirmação vencido ou já usado: o Better Auth volta para cá com `?error=…` (F-01).
    const { error } = await searchParams;
    redirect(error ? "/entrar?aviso=link-invalido" : "/entrar");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex items-center gap-3">
        <LogoIcon className="size-10" />
        <span className="text-2xl font-bold tracking-tight">Orçô</span>
      </div>
      <h1 className="text-2xl font-semibold">Você entrou como {user.email}</h1>
      <p className="text-muted-foreground">
        A sua lista de orçamentos chega em breve. Estamos construindo.
      </p>
    </main>
  );
}
