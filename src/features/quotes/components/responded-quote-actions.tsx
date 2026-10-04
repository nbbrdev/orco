"use client";

import { Copy, Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteQuoteAction, duplicateQuoteAction } from "@/features/quotes/actions";
import { downloadQuotePdf } from "@/features/quotes/download-pdf";
import { formatQuoteNumber } from "@/features/quotes/items";

import { QuoteActionsMenu } from "./quote-actions-menu";
import { StatusBadge } from "./status-badge";

// Topo do modo leitura (RN-25, NBB-53 M3-A): o número e o status; "Baixar PDF", que não muda o status
// de um respondido; "Duplicar para editar", que abre o editor da cópia (RN-28); e o menu "⋯" só com
// Excluir (RN-29).

export function RespondedQuoteActions({
  quoteId,
  quoteNumber,
  status,
}: {
  quoteId: string;
  quoteNumber: number;
  status: "approved" | "rejected";
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  async function download() {
    setDownloading(true);
    setMessage(await downloadQuotePdf(quoteId));
    setDownloading(false);
  }

  /** Na cópia, o duplicateQuoteAction leva ao editor; só volta aqui com uma mensagem de erro. */
  async function duplicate() {
    setDuplicating(true);
    setMessage(null);
    const result = await duplicateQuoteAction(quoteId);
    setMessage(result.message);
    setDuplicating(false);
  }

  async function remove() {
    const result = await deleteQuoteAction(quoteId);
    setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold">Orçamento Nº {formatQuoteNumber(quoteNumber)}</h1>
          <StatusBadge status={status} />
        </div>
        <QuoteActionsMenu quoteLabel={`Nº ${formatQuoteNumber(quoteNumber)}`} onDelete={remove} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={duplicating} onClick={() => void duplicate()}>
          <Copy aria-hidden="true" />
          {duplicating ? "Duplicando…" : "Duplicar para editar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={downloading}
          onClick={() => void download()}
        >
          <Download aria-hidden="true" />
          {downloading ? "Baixando…" : "Baixar PDF"}
        </Button>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
