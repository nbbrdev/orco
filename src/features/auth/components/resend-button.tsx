"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { resendAction } from "@/features/auth/actions";

// Botão "Reenviar" do e-mail de confirmação (F-01, F-03), com o mesmo anti-abuso do cadastro (D5).
export function ResendButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await resendAction({ email });
            setFeedback(
              result.status === "sent"
                ? "Enviamos de novo. Confira sua caixa de entrada."
                : result.message,
            );
          })
        }
      >
        {pending ? "Reenviando…" : "Reenviar"}
      </Button>
      {feedback ? (
        <p role="status" className="text-sm text-muted-foreground">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
