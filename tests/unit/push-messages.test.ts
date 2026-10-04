import { describe, expect, it } from "vitest";

import { firstName, responsePushMessage } from "@/features/push/messages";

// O texto dos avisos de push (RN-45, NBB-61 P6): só o número, o primeiro nome e o evento.

const base = {
  quoteId: "7d3f6a4e-1f2b-4c5d-8e9f-0a1b2c3d4e5f",
  number: 12,
  respondentName: null,
  clientName: null,
  reasonCode: null,
} as const;

describe("firstName", () => {
  it("fica só com o primeiro nome", () => {
    expect(firstName("  Maria  da Silva ")).toBe("Maria");
    expect(firstName("João")).toBe("João");
  });

  it("vazio ou só espaços vira nulo", () => {
    expect(firstName(null)).toBeNull();
    expect(firstName("   ")).toBeNull();
  });
});

describe("responsePushMessage", () => {
  it("aprovado: o primeiro nome informado, o número e o link do orçamento", () => {
    expect(
      responsePushMessage({ ...base, decision: "approved", respondentName: "Maria Silva" }),
    ).toEqual({
      title: "✅ Maria aprovou o orçamento Nº 0012",
      url: `/app/orcamentos/${base.quoteId}`,
      tag: `quote-${base.quoteId}`,
    });
  });

  it("recusado: o cliente do orçamento e o motivo", () => {
    expect(
      responsePushMessage({
        ...base,
        decision: "rejected",
        clientName: "João Souza",
        reasonCode: "price",
      }).title,
    ).toBe("❌ João recusou o orçamento Nº 0012 · Motivo: Preço");
  });

  it("sem nome nem motivo: 'Seu cliente'", () => {
    expect(responsePushMessage({ ...base, decision: "rejected" }).title).toBe(
      "❌ Seu cliente recusou o orçamento Nº 0012",
    );
  });
});
