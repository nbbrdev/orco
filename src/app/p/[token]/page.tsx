import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { logoUrl } from "@/features/profile/logo-rules";
import { isPreviewBot } from "@/features/public-quote/bots";
import { PublicQuoteView } from "@/features/public-quote/components/public-quote-view";
import { QuoteResponse } from "@/features/public-quote/components/quote-response";
import {
  getPublicQuote,
  isQuoteOwner,
  publicDocumentModel,
  registerQuoteView,
} from "@/features/public-quote/public-quote";
import { displayStatus } from "@/features/quotes/status";
import { getSessionUser } from "@/lib/auth/session";
import { formatDateBR, todayInAppTimeZone } from "@/lib/dates";
import { notifyFreelancer } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/request";

// Página pública do orçamento (F-07, F-08, NBB-53). Sem login: quem tem o link vê (RN-30). Sempre
// clara, como o PDF (doc 12). O token não vaza por Referer nem é indexado (headers do next.config e
// o `robots` abaixo, docs/07 §4).
// - Rascunho, excluído e token inválido: o mesmo "não encontrado" (RN-31).
// - Conta a visualização (RN-35) só de quem não é robô de pré-visualização nem o dono logado (P3-A).
// - Aprovar/Recusar só para um enviado dentro da validade, e nunca para o dono.

export const metadata: Metadata = {
  title: "Orçamento",
  robots: { index: false, follow: false },
};

/** Aberturas da página por minuto por IP (RN-39). */
const VIEW_LIMIT_PER_MINUTE = 60;

const dayMonth = (date: string) => formatDateBR(date).slice(0, 5);

export default async function PublicQuotePage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const headerList = await headers();
  const ip = clientIpFrom(headerList);

  if (!(await checkRateLimit(`view:ip:${ip}`, VIEW_LIMIT_PER_MINUTE, 60))) {
    return (
      <PublicShell>
        <p role="alert">Muitas tentativas, aguarde um instante.</p>
      </PublicShell>
    );
  }

  const quote = await getPublicQuote(token);
  if (!quote) {
    notFound();
  }

  const session = await getSessionUser();
  const owner = session ? await isQuoteOwner(session.id, token) : false;
  const userAgent = headerList.get("user-agent");
  if (!owner && !isPreviewBot(userAgent)) {
    // Depois de responder a página: a contagem (e, na primeira, o push ao freelancer, NBB-61 N4) não
    // atrasa quem está abrindo.
    after(() => registerQuoteView(token, ip, userAgent, notifyFreelancer));
  }

  const model = publicDocumentModel(quote);
  const status = displayStatus(quote.status, quote.validUntil);
  const who = model.issuer.name ?? "quem enviou o orçamento";
  const canRespond = status === "sent" && !owner;

  return (
    <PublicShell withActionBar={canRespond}>
      {owner ? (
        <p role="note" className="rounded-lg bg-muted p-3 text-sm">
          Você está vendo como o seu cliente vê.
        </p>
      ) : null}

      {quote.respondedAt && (status === "approved" || status === "rejected") ? (
        <p
          role="status"
          className={
            status === "approved"
              ? "rounded-lg bg-status-approved-bg p-3 font-medium text-status-approved"
              : "rounded-lg bg-status-rejected-bg p-3 font-medium text-status-rejected"
          }
        >
          {status === "approved" ? "Aprovado" : "Recusado"} em{" "}
          {dayMonth(todayInAppTimeZone(quote.respondedAt))}
        </p>
      ) : null}

      {status === "expired" ? (
        <p role="status" className="rounded-lg bg-status-expired-bg p-3 text-status-expired">
          Este orçamento venceu em {dayMonth(quote.validUntil)}. Fale com {who} para renovar.
        </p>
      ) : null}

      <PublicQuoteView
        model={model}
        logoUrl={quote.issuer.logoPath ? logoUrl(quote.issuer.logoPath) : null}
      />

      <div>
        <a
          href={`/api/p/${token}/pdf`}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Baixar PDF
        </a>
      </div>

      {canRespond ? (
        <QuoteResponse
          key={quote.version}
          token={token}
          version={quote.version}
          number={model.number}
          issuerName={model.issuer.name}
          issuerPhone={quote.issuer.phone}
        />
      ) : null}
    </PublicShell>
  );
}

function PublicShell({
  children,
  withActionBar = false,
}: {
  children: React.ReactNode;
  withActionBar?: boolean;
}) {
  return (
    <main className="light-scheme min-h-dvh bg-background text-foreground">
      {/* Com os botões fixos no rodapé do celular, um espaço a mais embaixo para não cobrir o fim. */}
      <div
        className={`mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 ${withActionBar ? "pb-28 md:pb-12" : ""}`}
      >
        {children}
      </div>
    </main>
  );
}
