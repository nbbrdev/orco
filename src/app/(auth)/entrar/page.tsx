import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { GoogleButton } from "@/features/auth/components/google-button";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { AFTER_CONFIRM_PATH } from "@/features/auth/sign-up";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  // F-01: link de confirmação vencido ou já usado. Ao entrar com uma conta ainda não confirmada, a
  // tela oferece o "Reenviar".
  "link-invalido":
    "Este link expirou ou já foi usado. Entre com seu e-mail e senha: se a conta ainda não estiver ativada, você poderá pedir um link novo.",
  // F-04 (P2): o Better Auth não faz login ao redefinir a senha.
  "senha-alterada": "Senha alterada. Entre com a nova senha.",
};

/** Volta do Google com erro (F-02, NBB-40 G5): o Better Auth manda o código em `?error=`. */
function googleError(code: string): string {
  switch (code) {
    case "access_denied":
      return "Login cancelado.";
    // Conta por senha com o mesmo e-mail, ainda não confirmada: o Better Auth não vincula, para
    // ninguém tomar a conta de outra pessoa cadastrando o e-mail dela antes (docs/07 §1).
    case "unable_to_link_account":
      return "Este e-mail já tem uma conta esperando confirmação. Abra o link que enviamos (ou entre e peça um novo) e depois use o Google.";
    default:
      return "Não foi possível entrar com o Google. Tente de novo.";
  }
}

// F-03: entrar com e-mail e senha; F-02: com o Google.
export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  // P6: quem já está logado vai direto para o app.
  if (await getSessionUser()) {
    redirect(AFTER_CONFIRM_PATH);
  }
  const { aviso, error } = await searchParams;
  const notice = typeof aviso === "string" ? NOTICES[aviso] : undefined;

  return (
    <AuthShell title="Entrar no Orçô">
      {notice ? (
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {typeof error === "string" ? (
        <p role="alert" className="rounded-lg border border-border bg-muted p-3 text-sm">
          {googleError(error)}
        </p>
      ) : null}
      <GoogleButton />
      <SignInForm />
    </AuthShell>
  );
}
