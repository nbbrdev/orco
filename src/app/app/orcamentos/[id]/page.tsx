import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { listCatalogItems } from "@/features/catalog/catalog";
import { listClients } from "@/features/clients/clients";
import { QuoteEditor } from "@/features/quotes/components/quote-editor";
import { newItemDraft, toItemDraft, toOptionsDraft } from "@/features/quotes/items";
import { getQuoteForEditor } from "@/features/quotes/quotes";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orçamento" };

// Editor de orçamento (F-05, NBB-86/87/88). Orçamento de outra conta ou inexistente: 404. Clientes e
// catálogo chegam inteiros (no máximo 1.000 e 500), para a busca e as sugestões no navegador.
export default async function QuotePage({ params }: PageProps<"/app/orcamentos/[id]">) {
  const user = await requireSessionUser();
  const { id } = await params;
  const [quote, clients, catalog] = await Promise.all([
    getQuoteForEditor(user.id, id),
    listClients(user.id),
    listCatalogItems(user.id),
  ]);
  if (!quote) {
    notFound();
  }

  // Orçamento novo já abre com um item vazio, pronto para digitar. O id nasce aqui, no servidor, para
  // ser o mesmo na página e no navegador.
  const items = quote.items.length > 0 ? quote.items.map(toItemDraft) : [newItemDraft()];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <QuoteEditor
        quoteId={quote.id}
        quoteNumber={quote.number}
        initialItems={items}
        initialOptions={toOptionsDraft(quote.options)}
        initialClient={quote.client}
        clients={clients}
        initialCatalog={catalog}
      />
    </div>
  );
}
