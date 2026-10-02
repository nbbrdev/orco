import type { Metadata } from "next";

import { ComingSoon } from "@/features/app-shell/components/coming-soon";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil" };

// Página PROVISÓRIA (NBB-41, N1/N3): o perfil completo (F-14) chega na NBB-42. A seção "Conta", com
// o Sair, já fica no lugar definitivo.
export default async function ProfilePage() {
  const user = await requireSessionUser();

  return (
    <ComingSoon title="Perfil">
      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-lg font-semibold">
          Conta
        </h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div>
          <SignOutButton />
        </div>
      </section>
    </ComingSoon>
  );
}
