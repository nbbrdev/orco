"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";

// Sair (RF-06): a sessão é apagada no banco e a pessoa volta para o /entrar.
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      <LogOut aria-hidden="true" />
      {pending ? "Saindo…" : "Sair"}
    </Button>
  );
}
