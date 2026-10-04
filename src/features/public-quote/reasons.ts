// Motivos rápidos da recusa (RN-33): os chips da página pública e o texto da faixa do resultado no
// editor (NBB-53). Os códigos são os do enum `reject_reason` do banco.

export const REJECT_REASONS = [
  { code: "price", label: "Preço" },
  { code: "deadline", label: "Prazo" },
  { code: "gave_up", label: "Desisti" },
  { code: "other", label: "Outro" },
] as const;

export type RejectReasonCode = (typeof REJECT_REASONS)[number]["code"];

export function rejectReasonLabel(code: RejectReasonCode): string {
  return REJECT_REASONS.find((reason) => reason.code === code)?.label ?? code;
}
