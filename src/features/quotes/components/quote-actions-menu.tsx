"use client";

import { Copy, EllipsisVertical, RefreshCw, Trash2 } from "lucide-react";
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

import { CopyLinkItem } from "./copy-link-item";

// Menu "⋯" do orçamento, no topo do editor (F-12, F-13, NBB-49 P1-A): Duplicar, Gerar novo link (só
// no enviado, NBB-54 C5-A) e Excluir. No modo leitura: Copiar link, Gerar novo link e Excluir
// (NBB-53 M3-A, NBB-54 C5-A). Excluir e Gerar novo link pedem confirmação (RN-29, RN-36). Quem faz o
// trabalho é a tela, que antes salva o que estiver pendente.

type Confirmation = "delete" | "regenerate";

export function QuoteActionsMenu({
  quoteLabel,
  onDuplicate,
  onCopyLink,
  onRegenerateLink,
  onDelete,
}: {
  /** "Nº 0001", para a pergunta da exclusão. */
  quoteLabel: string;
  /** Sem ele, o menu não mostra o Duplicar (o modo leitura tem o botão próprio, NBB-53 M3-A). */
  onDuplicate?: () => Promise<void>;
  /** Só no modo leitura: no editor, o Copiar link fica no Compartilhar. */
  onCopyLink?: () => Promise<boolean>;
  /** Sem ele (rascunho), o menu não mostra o Gerar novo link. */
  onRegenerateLink?: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Guardado à parte, para o texto da janela não trocar enquanto ela fecha.
  const [confirmation, setConfirmation] = useState<Confirmation>("delete");
  const [pending, setPending] = useState(false);

  function confirm(kind: Confirmation) {
    setConfirmation(kind);
    setConfirming(true);
  }

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
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
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
        <DropdownMenuContent align="end" className="w-48">
          {onDuplicate ? (
            <DropdownMenuItem onSelect={() => void run(onDuplicate)}>
              <Copy aria-hidden="true" />
              Duplicar
            </DropdownMenuItem>
          ) : null}
          {onCopyLink ? (
            <CopyLinkItem onCopy={onCopyLink} onDone={() => setMenuOpen(false)} />
          ) : null}
          {onRegenerateLink ? (
            <DropdownMenuItem onSelect={() => confirm("regenerate")}>
              <RefreshCw aria-hidden="true" />
              Gerar novo link
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={() => confirm("delete")}>
            <Trash2 aria-hidden="true" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
        <AlertDialogContent>
          {confirmation === "regenerate" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Gerar novo link?</AlertDialogTitle>
                <AlertDialogDescription>O link atual deixará de funcionar.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void run(async () => {
                      await onRegenerateLink?.();
                      setConfirming(false);
                    })
                  }
                >
                  {pending ? "Gerando…" : "Gerar novo link"}
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir o orçamento {quoteLabel}?</AlertDialogTitle>
                <AlertDialogDescription>O link deixará de funcionar.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
                {/* Um botão comum, e não o AlertDialogAction, para a janela só fechar depois de
                    excluir. */}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => void run(onDelete)}
                >
                  {pending ? "Excluindo…" : "Excluir"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
