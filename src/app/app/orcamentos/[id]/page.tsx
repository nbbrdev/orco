import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuoteEditor } from "@/features/quotes/components/quote-editor";
import { newItemDraft, toItemDraft } from "@/features/quotes/items";
import { getQuoteForEditor } from "@/features/quotes/quotes";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orçamento" };

// Editor de orçamento (F-05, NBB-86). Orçamento de outra conta ou inexistente: 404.
export default async function QuotePage({ params }: PageProps<"/app/orcamentos/[id]">) {
  const user = await requireSessionUser();
  const { id } = await params;
  const quote = await getQuoteForEditor(user.id, id);
  if (!quote) {
    notFound();
  }

  // Orçamento novo já abre com um item vazio, pronto para digitar. O id nasce aqui, no servidor, para
  // ser o mesmo na página e no navegador.
  const items = quote.items.length > 0 ? quote.items.map(toItemDraft) : [newItemDraft()];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <QuoteEditor quoteId={quote.id} quoteNumber={quote.number} initialItems={items} />
    </div>
  );
}
