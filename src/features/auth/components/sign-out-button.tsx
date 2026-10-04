"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { pushSupported, unsubscribeThisDevice } from "@/features/push/device";

// Sair (RF-06): a sessão é apagada no banco e a pessoa volta para o /entrar. Antes, desliga as
// notificações deste aparelho (NBB-61 N5): num aparelho compartilhado, os avisos desta conta não
// continuam chegando para quem usar depois. Se isso falhar (ex.: sem internet), sai do mesmo jeito.

const UNSUBSCRIBE_TIMEOUT_MS = 3000;

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  async function signOut() {
    if (pushSupported()) {
      // No máximo 3 s: sem service worker registrado, a espera por ele nunca terminaria.
      await Promise.race([
        unsubscribeThisDevice().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, UNSUBSCRIBE_TIMEOUT_MS)),
      ]);
    }
    await signOutAction();
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(signOut)}
    >
      <LogOut aria-hidden="true" />
      {pending ? "Saindo…" : "Sair"}
    </Button>
  );
}
