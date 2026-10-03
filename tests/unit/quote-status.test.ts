import { describe, expect, it } from "vitest";

import { displayStatus, STATUS_LABELS, updateDraftsQuestion } from "@/features/quotes/status";

// Status como a pessoa vê (NBB-87 D1-A) e a pergunta dos rascunhos (RN-20, RN-11, D3-A, D4-A).

// 12/10/2026 ao meio-dia em São Paulo.
const now = new Date("2026-10-12T15:00:00Z");

describe("displayStatus (RN-26)", () => {
  it("enviado com a validade vencida aparece como expirado", () => {
    expect(displayStatus("sent", "2026-10-11", now)).toBe("expired");
    expect(displayStatus("sent", "2026-10-12", now)).toBe("sent");
  });

  it("os outros status não expiram", () => {
    expect(displayStatus("draft", "2020-01-01", now)).toBe("draft");
    expect(displayStatus("approved", "2020-01-01", now)).toBe("approved");
    expect(displayStatus("rejected", "2020-01-01", now)).toBe("rejected");
  });

  it("rótulos em português", () => {
    expect(STATUS_LABELS).toEqual({
      draft: "Rascunho",
      sent: "Enviado",
      approved: "Aprovado",
      rejected: "Recusado",
      expired: "Expirado",
    });
  });
});

describe("updateDraftsQuestion", () => {
  it("cliente, no singular e no plural (RN-20)", () => {
    expect(updateDraftsQuestion(1, "client")).toBe("Atualizar também o rascunho deste cliente?");
    expect(updateDraftsQuestion(3, "client")).toBe(
      "Atualizar também os 3 rascunhos deste cliente?",
    );
  });

  it("item do catálogo, no singular e no plural (RN-11)", () => {
    expect(updateDraftsQuestion(1, "catalogItem")).toBe(
      "Atualizar também o rascunho que usa este item?",
    );
    expect(updateDraftsQuestion(2, "catalogItem")).toBe(
      "Atualizar também os 2 rascunhos que usam este item?",
    );
  });
});
