import { rejectReasonLabel } from "@/features/public-quote/reasons";
import type { QuoteResponse } from "@/features/quotes/quotes";
import { formatDateTimeBR } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Faixa do resultado no topo do modo leitura (NBB-53 M2): quem aprovou e quando, ou quando recusou,
// com o motivo e o texto do cliente. Data com ano e hora, no fuso de São Paulo. Sem o evento da
// resposta (não deveria acontecer: o respond_to_quote grava os dois juntos), mostra só o status.

export function ResponseBanner({
  status,
  response,
}: {
  status: "approved" | "rejected";
  response: QuoteResponse | null;
}) {
  const approved = status === "approved";
  const when = response ? ` em ${formatDateTimeBR(response.respondedAt)}` : "";
  const who = approved && response?.respondentName ? ` por ${response.respondentName}` : "";
  const reason =
    !approved && response?.reasonCode ? ` · Motivo: ${rejectReasonLabel(response.reasonCode)}` : "";

  return (
    <section
      aria-label="Resposta do cliente"
      className={cn(
        "flex flex-col gap-1 rounded-lg px-4 py-3",
        approved ? "bg-status-approved-bg text-status-approved" : "bg-muted text-foreground",
      )}
    >
      <p className="font-medium break-words">
        {approved ? "Aprovado" : "Recusado"}
        {who}
        {when}
        {reason}
      </p>
      {!approved && response?.reason ? (
        <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
          “{response.reason}”
        </p>
      ) : null}
    </section>
  );
}
