"use client";

import { Copy, EllipsisVertical, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Menu "⋯" do orçamento, no topo do editor (F-12, F-13, NBB-49 P1-A): Duplicar e Excluir; no modo
// leitura, só Excluir (NBB-53 M3-A). Excluir pede confirmação (RN-29). Quem faz o trabalho é o
// editor, que antes salva o que estiver pendente.

export function QuoteActionsMenu({
  quoteLabel,
  onDuplicate,
  onDelete,
}: {
  /** "Nº 0001", para a pergunta da exclusão. */
  quoteLabel: string;
  /** Sem ele, o menu não mostra o Duplicar (o modo leitura tem o botão próprio, NBB-53 M3-A). */
  onDuplicate?: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function run(task: () => Promise<void>) {
    setPending(true);
    try {
      await task();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* modal={false}: a janela de confirmação abre logo depois que o menu fecha, sem os dois
          disputarem o foco e o bloqueio da página. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Ações do orçamento"
            disabled={pending}
          >
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onDuplicate ? (
            <DropdownMenuItem onSelect={() => void run(onDuplicate)}>
              <Copy aria-hidden="true" />
              Duplicar
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o orçamento {quoteLabel}?</AlertDialogTitle>
            <AlertDialogDescription>O link deixará de funcionar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            {/* Um botão comum, e não o AlertDialogAction, para a janela só fechar depois de excluir. */}
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void run(onDelete)}
            >
              {pending ? "Excluindo…" : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
