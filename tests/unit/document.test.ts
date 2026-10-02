import { describe, expect, it } from "vitest";

import { formatDocument, normalizeDocument } from "@/lib/document";

// CPF e CNPJ (RN-08, NBB-42). Números de exemplo públicos, sem pessoa ou empresa real por trás.

describe("normalizeDocument", () => {
  it("aceita CPF válido, com ou sem pontuação", () => {
    expect(normalizeDocument("529.982.247-25")).toBe("52998224725");
    expect(normalizeDocument("52998224725")).toBe("52998224725");
  });

  it("aceita CNPJ numérico válido", () => {
    expect(normalizeDocument("11.222.333/0001-81")).toBe("11222333000181");
  });

  it("aceita CNPJ alfanumérico válido (formato da Receita desde julho de 2026)", () => {
    expect(normalizeDocument("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it("recusa dígito verificador errado", () => {
    expect(normalizeDocument("529.982.247-24")).toBeNull();
    expect(normalizeDocument("11.222.333/0001-82")).toBeNull();
    expect(normalizeDocument("12.ABC.345/01DE-36")).toBeNull();
  });

  it("recusa sequências repetidas e tamanhos errados", () => {
    expect(normalizeDocument("111.111.111-11")).toBeNull();
    expect(normalizeDocument("123")).toBeNull();
    expect(normalizeDocument("1234567890123456")).toBeNull();
  });
});

describe("formatDocument", () => {
  it("formata CPF e CNPJ", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatDocument("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});
