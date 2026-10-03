"use client";

import { useEffect } from "react";

import { markResponseSeenAction } from "@/features/quotes/actions";

// Ao abrir um orçamento respondido, o selo "novo" some da lista (RN-42, NBB-48 L4-A). Roda no
// navegador, depois de a página abrir de verdade: o pré-carregamento de um link nunca marca nada.

export function MarkResponseSeen({ quoteId }: { quoteId: string }) {
  useEffect(() => {
    void markResponseSeenAction(quoteId);
  }, [quoteId]);
  return null;
}
