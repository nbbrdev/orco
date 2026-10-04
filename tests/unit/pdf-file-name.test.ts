import { describe, expect, it } from "vitest";

import { quotePdfFileName } from "@/pdf/file-name";

// Nome do arquivo do PDF (F-06, NBB-51 P6).

describe("quotePdfFileName", () => {
  it("número com 4 dígitos e o cliente sem acentos, com hífens", () => {
    expect(quotePdfFileName(1, "Maria Silva")).toBe("Orcamento-0001-Maria-Silva.pdf");
    expect(quotePdfFileName(12, "João da Conceição")).toBe("Orcamento-0012-Joao-da-Conceicao.pdf");
  });

  it("tira símbolos e espaços sobrando", () => {
    expect(quotePdfFileName(3, "  Ana & Cia. Ltda!  ")).toBe("Orcamento-0003-Ana-Cia-Ltda.pdf");
  });

  it("sem cliente, ou com um nome sem letras e números, fica só o número", () => {
    expect(quotePdfFileName(7, null)).toBe("Orcamento-0007.pdf");
    expect(quotePdfFileName(7, "***")).toBe("Orcamento-0007.pdf");
  });

  it("corta nomes muito longos sem deixar hífen no fim", () => {
    const name = quotePdfFileName(1, `${"a".repeat(59)} ${"b".repeat(20)}`);
    expect(name).toBe(`Orcamento-0001-${"a".repeat(59)}.pdf`);
  });
});
