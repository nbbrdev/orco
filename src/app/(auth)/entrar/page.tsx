import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

// F-03: entrar com e-mail e senha.
export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const { aviso } = await searchParams;

  return (
    <AuthShell title="Entrar no Orçô">
      {aviso === "link-invalido" ? (
        // F-01: link de confirmação vencido ou já usado. Ao entrar com uma conta ainda não
        // confirmada, a tela oferece o "Reenviar".
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
          Este link expirou ou já foi usado. Entre com seu e-mail e senha: se a conta ainda não
          estiver ativada, você poderá pedir um link novo.
        </p>
      ) : null}
      <SignInForm />
    </AuthShell>
  );
}
