import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Criar nova senha" };

// F-04: o link do e-mail passa por /api/auth/reset-password/:token, que confere o token e manda para
// cá com `?token=…` (válido) ou `?error=INVALID_TOKEN` (vencido ou já usado). O token só é consumido
// ao salvar a senha.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string" || !token) {
    redirect("/recuperar-senha?aviso=link-invalido");
  }

  return (
    <AuthShell title="Crie uma senha nova">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
