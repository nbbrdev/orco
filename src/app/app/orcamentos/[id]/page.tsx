import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { listCatalogItems } from "@/features/catalog/catalog";
import { listClients } from "@/features/clients/clients";
import { getProfile } from "@/features/profile/profile";
import { logoUrl } from "@/features/profile/logo-rules";
import { PublicQuoteView } from "@/features/public-quote/components/public-quote-view";
import { InternalNotes } from "@/features/quotes/components/internal-notes";
import { MarkResponseSeen } from "@/features/quotes/components/mark-response-seen";
import { QuoteEditor } from "@/features/quotes/components/quote-editor";
import { RespondedQuoteActions } from "@/features/quotes/components/responded-quote-actions";
import { ResponseBanner } from "@/features/quotes/components/response-banner";
import { newItemDraft, toItemDraft, toOptionsDraft } from "@/features/quotes/items";
import { ownerDocumentInput } from "@/features/quotes/pdf";
import { type EditorQuote, getQuoteForEditor, getQuoteResponse } from "@/features/quotes/quotes";
import { requireSessionUser } from "@/lib/auth/session";
import { buildQuoteDocument } from "@/pdf/model";

export const metadata: Metadata = { title: "Orçamento" };

// Editor de orçamento (F-05, NBB-86/87/88). Orçamento de outra conta ou inexistente: 404. Clientes e
// catálogo chegam inteiros (no máximo 1.000 e 500), para a busca e as sugestões no navegador.
// Aprovado ou recusado abre em modo leitura (RN-25, NBB-53 M1-A).
export default async function QuotePage({ params }: PageProps<"/app/orcamentos/[id]">) {
  const user = await requireSessionUser();
  const { id } = await params;
  const quote = await getQuoteForEditor(user.id, id);
  if (!quote) {
    notFound();
  }

  const content =
    quote.status === "approved" || quote.status === "rejected" ? (
      <RespondedQuote userId={user.id} quote={quote} status={quote.status} />
    ) : (
      <Editor userId={user.id} quote={quote} />
    );

  return (
    <div className="mx-auto w-full max-w-3xl">
      {quote.responseUnseen ? <MarkResponseSeen quoteId={quote.id} /> : null}
      {content}
    </div>
  );
}

async function Editor({ userId, quote }: { userId: string; quote: EditorQuote }) {
  const [clients, catalog] = await Promise.all([listClients(userId), listCatalogItems(userId)]);

  // Orçamento novo já abre com um item vazio, pronto para digitar. O id nasce aqui, no servidor, para
  // ser o mesmo na página e no navegador.
  const items = quote.items.length > 0 ? quote.items.map(toItemDraft) : [newItemDraft()];

  return (
    <QuoteEditor
      quoteId={quote.id}
      quoteNumber={quote.number}
      quoteStatus={quote.status}
      publicToken={quote.publicToken}
      defaultValidityDays={quote.defaultValidityDays}
      initialItems={items}
      initialOptions={toOptionsDraft(quote.options)}
      initialClient={quote.client}
      clients={clients}
      initialCatalog={catalog}
    />
  );
}

/**
 * Modo leitura (RN-25, NBB-53 P8-A): o resultado no topo, as anotações internas (o único campo
 * editável, RN-20a) e o orçamento como o cliente vê, com o mesmo componente da página pública.
 */
async function RespondedQuote({
  userId,
  quote,
  status,
}: {
  userId: string;
  quote: EditorQuote;
  status: "approved" | "rejected";
}) {
  const [response, profile] = await Promise.all([
    getQuoteResponse(userId, quote.id),
    getProfile(userId),
  ]);
  const model = buildQuoteDocument(ownerDocumentInput(quote, profile, null));

  return (
    <div className="flex flex-col gap-6">
      <RespondedQuoteActions
        quoteId={quote.id}
        quoteNumber={quote.number}
        status={status}
        publicToken={quote.publicToken}
      />
      <ResponseBanner status={status} response={response} />
      <InternalNotes quoteId={quote.id} initialNotes={quote.options.internalNotes ?? ""} />
      <section aria-labelledby="client-view-heading" className="flex flex-col gap-3">
        <h2 id="client-view-heading" className="text-base font-medium">
          Como o cliente vê
        </h2>
        <div className="rounded-lg border border-border p-4 sm:p-6">
          <PublicQuoteView
            model={model}
            logoUrl={profile.logoPath ? logoUrl(profile.logoPath) : null}
          />
        </div>
      </section>
    </div>
  );
}
