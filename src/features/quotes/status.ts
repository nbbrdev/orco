import { type IsoDate, isExpired } from "@/lib/dates";

// Status do orçamento como a pessoa vê (NBB-87 D1-A). "Expirado" não é guardado: é um enviado com a
// validade vencida, calculado no fuso de São Paulo (RN-26).

export type QuoteStatus = "draft" | "sent" | "approved" | "rejected";
export type DisplayStatus = QuoteStatus | "expired";

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
  expired: "Expirado",
};

export function displayStatus(
  status: QuoteStatus,
  validUntil: IsoDate,
  now: Date = new Date(),
): DisplayStatus {
  return status === "sent" && isExpired(validUntil, now) ? "expired" : status;
}

/**
 * A pergunta depois de salvar um cliente ou item do catálogo usado em rascunhos (RN-20, RN-11,
 * D3-A, D4-A).
 */
export function updateDraftsQuestion(count: number, kind: "client" | "catalogItem"): string {
  if (kind === "client") {
    return count === 1
      ? "Atualizar também o rascunho deste cliente?"
      : `Atualizar também os ${count} rascunhos deste cliente?`;
  }
  return count === 1
    ? "Atualizar também o rascunho que usa este item?"
    : `Atualizar também os ${count} rascunhos que usam este item?`;
}
