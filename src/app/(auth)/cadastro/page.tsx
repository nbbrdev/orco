import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { AFTER_CONFIRM_PATH } from "@/features/auth/sign-up";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Criar conta" };

// F-01: cadastro com e-mail e senha.
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
      <SignUpForm />
    </AuthShell>
  );
}
