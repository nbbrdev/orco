"use client";

import { Download, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { CopyLinkItem } from "./copy-link-item";

// "Compartilhar" no rodapé do editor (F-06, NBB-54 C2-A): um menu com Copiar link, WhatsApp e Baixar
// PDF. Os três enviam o rascunho (RN-22); quem confere a RN-13 e envia é o editor.

export function ShareMenu({
  downloading,
  onCopyLink,
  onWhatsApp,
  onDownload,
}: {
  downloading: boolean;
  onCopyLink: () => Promise<boolean>;
  onWhatsApp: () => void;
  onDownload: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" disabled={downloading}>
          <Share2 aria-hidden="true" />
          {downloading ? "Baixando…" : "Compartilhar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-48">
        <CopyLinkItem onCopy={onCopyLink} onDone={() => setOpen(false)} />
        <DropdownMenuItem onSelect={onWhatsApp}>
          <MessageCircle aria-hidden="true" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownload}>
          <Download aria-hidden="true" />
          Baixar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
