import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { GoogleButton } from "@/features/auth/components/google-button";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { AFTER_CONFIRM_PATH } from "@/features/auth/sign-up";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Criar conta" };

// F-01: cadastro com e-mail e senha; F-02: com o Google.
export default async function SignUpPage() {
  // P6: quem já está logado vai direto para o app.
  if (await getSessionUser()) {
    redirect(AFTER_CONFIRM_PATH);
  }

  return (
    <AuthShell
      title="Crie sua conta grátis"
      description="Em menos de 2 minutos você envia o seu primeiro orçamento."
    >
      <GoogleButton />
      <SignUpForm />
      {/* Aceite sem caixa de marcar, para não somar um passo ao cadastro (NBB-30 T5). Vale para o
          cadastro por e-mail e pelo Google. */}
      <p className="text-sm text-muted-foreground">
        Ao criar a conta, você concorda com os{" "}
        <Link
          href="/termos"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link
          href="/privacidade"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Política de privacidade
        </Link>
        .
      </p>
    </AuthShell>
  );
}
