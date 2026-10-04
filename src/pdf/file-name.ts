import { formatQuoteNumber } from "@/features/quotes/items";

// Nome do arquivo do PDF (F-06, NBB-51 P6): "Orcamento-0001-Maria-Silva.pdf", sem acentos e com
// hífens, para funcionar em qualquer sistema e anexo de e-mail. Sem cliente, "Orcamento-0001.pdf".

/** "Maria da Silva" → "Maria-da-Silva": só letras e números sem acento, separados por hífen. */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function quotePdfFileName(quoteNumber: number, clientName: string | null): string {
  const client = clientName ? slug(clientName) : "";
  return `Orcamento-${formatQuoteNumber(quoteNumber)}${client ? `-${client}` : ""}.pdf`;
}
