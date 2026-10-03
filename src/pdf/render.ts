import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { registerFonts } from "./fonts";
import { buildQuoteDocument, type QuoteDocumentInput } from "./model";
import { QuoteDocument } from "./quote-document";

// Gera o PDF do orçamento (ADR-0003, NBB-50). Quem chama (as rotas da NBB-51) busca os dados, com a
// sessão ou o token, e converte o logo para PNG (logo.ts) antes.

export async function renderQuotePdf(input: QuoteDocumentInput): Promise<Uint8Array> {
  registerFonts();
  // O QuoteDocument devolve um <Document>, mas o tipo do renderToBuffer só aceita o próprio Document.
  const document = createElement(QuoteDocument, {
    model: buildQuoteDocument(input),
  }) as unknown as ReactElement<DocumentProps>;
  return new Uint8Array(await renderToBuffer(document));
}
