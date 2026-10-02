import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { RecoveryForm } from "@/features/auth/components/recovery-form";

export const metadata: Metadata = { title: "Recuperar senha" };

// F-04: pedir o link de redefinição. Aberta para todos, logado ou não.
export default async function RecoveryPage({ searchParams }: PageProps<"/recuperar-senha">) {
  const { aviso } = await searchParams;

  return (
    <AuthShell
      title="Esqueceu sua senha?"
      description="Informe o e-mail da sua conta e enviamos um link para criar uma senha nova."
    >
      {aviso === "link-invalido" ? (
        // P9: link de redefinição vencido ou já usado.
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
          Este link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      ) : null}
      <RecoveryForm />
    </AuthShell>
  );
}
