import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

// F-01: cadastro com e-mail e senha.
export default function SignUpPage() {
  return (
    <AuthShell
      title="Crie sua conta grátis"
      description="Em menos de 2 minutos você envia o seu primeiro orçamento."
    >
      <SignUpForm />
    </AuthShell>
  );
}
