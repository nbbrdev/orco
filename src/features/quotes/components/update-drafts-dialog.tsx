"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// A pergunta depois de salvar um cliente ou item do catálogo usado em rascunhos (RN-20, RN-11,
// NBB-87 D3-A e D4-A). O que já foi salvo continua salvo; aqui só se decide se os rascunhos também
// mudam. Orçamentos enviados, aprovados e recusados nunca mudam.
// Fica na lista, e não dentro do painel: o painel fecha ao salvar, e a pergunta abre em seguida.
// Uma janela do Radix dentro do painel (outra janela) não fechava depois de responder.

export function UpdateDraftsDialog({
  question,
  onUpdate,
  onDone,
}: {
  /** A pergunta, ou `null` para não mostrar a janela. */
  question: string | null;
  /** Atualiza os rascunhos; `false` se não deu certo. */
  onUpdate: () => Promise<boolean>;
  /** Chamado depois da resposta (atualizou ou "Agora não"). */
  onDone: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <AlertDialog open={question !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{question}</AlertDialogTitle>
          <AlertDialogDescription>
            Orçamentos já enviados, aprovados ou recusados não mudam.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível atualizar os rascunhos. Tente de novo.
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onDone}>
            Agora não
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              void (async () => {
                setPending(true);
                const ok = await onUpdate();
                setPending(false);
                setFailed(!ok);
                if (ok) onDone();
              })()
            }
          >
            {pending ? "Atualizando…" : "Atualizar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
