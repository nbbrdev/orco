"use client";

import { Link } from "lucide-react";
import { useState } from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

// "Copiar link" dentro de um menu (F-06, NBB-54 C3-A): o menu fica aberto por um instante com "Link
// copiado ✓", anunciado ao leitor de tela, e depois fecha. Se não copiou, fecha na hora (quem chamou
// mostra o motivo).

const COPIED_MS = 1500;

export function CopyLinkItem({
  onCopy,
  onDone,
}: {
  /** Copia (logo no toque) e diz se deu certo. */
  onCopy: () => Promise<boolean>;
  /** Fecha o menu. */
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function select(event: Event) {
    event.preventDefault();
    if (copied) return;
    void onCopy().then((ok) => {
      if (!ok) {
        onDone();
        return;
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onDone();
      }, COPIED_MS);
    });
  }

  return (
    <DropdownMenuItem onSelect={select}>
      <Link aria-hidden="true" />
      <span aria-live="polite">{copied ? "Link copiado ✓" : "Copiar link"}</span>
    </DropdownMenuItem>
  );
}
