import { describe, expect, it } from "vitest";

import { describePrice, priceToInput } from "@/features/catalog/price";
import { catalogItemSchema } from "@/features/catalog/schemas";
import { searchCatalogItems } from "@/features/catalog/search";

// Formulário, preço e busca do catálogo (F-16, NBB-45).

describe("formulário do item", () => {
  it("só o nome é obrigatório; preço vazio = sem preço (RN-10)", () => {
    expect(catalogItemSchema.parse({ name: " Logo ", unit: "", unitPrice: "" })).toEqual({
      name: "Logo",
      unit: null,
      unitPrice: null,
    });
    expect(catalogItemSchema.safeParse({ name: "", unit: "", unitPrice: "" }).success).toBe(false);
  });

  it("preço no formato brasileiro vira centavos (I2-A)", () => {
    const parse = (unitPrice: string) =>
      catalogItemSchema.parse({ name: "x", unit: "", unitPrice }).unitPrice;
    expect(parse("800")).toBe(80000);
    expect(parse("1.234,56")).toBe(123456);
    expect(parse("R$ 12,5")).toBe(1250);
    expect(parse("0")).toBe(0);
  });

  it("recusa preço inválido, negativo ou acima de R$ 9.999.999,99 (I3-A)", () => {
    const error = (unitPrice: string) =>
      catalogItemSchema.safeParse({ name: "x", unit: "", unitPrice }).error?.issues[0]?.message;
    expect(error("doze")).toBe("Informe um preço válido, ex.: 1.234,56");
    expect(error("-10")).toBe("Informe um preço válido, ex.: 1.234,56");
    expect(error("9.999.999,99")).toBeUndefined();
    expect(error("10.000.000")).toMatch(/^O preço pode ser de até R\$\s9\.999\.999,99\.$/u);
  });

  it("unidade com até 10 caracteres (I4-A)", () => {
    expect(catalogItemSchema.parse({ name: "x", unit: " m² ", unitPrice: "" }).unit).toBe("m²");
    expect(
      catalogItemSchema.safeParse({ name: "x", unit: "a".repeat(11), unitPrice: "" }).success,
    ).toBe(false);
  });
});

describe("exibição do preço (I6-A)", () => {
  it("na lista", () => {
    expect(describePrice({ unit: "h", unitPriceCents: 80000 })).toMatch(/^R\$\s800,00 \/ h$/u);
    expect(describePrice({ unit: null, unitPriceCents: 80000 })).toMatch(/^R\$\s800,00$/u);
    expect(describePrice({ unit: "h", unitPriceCents: null })).toBe("Sem preço");
  });

  it("no campo, sem o R$", () => {
    expect(priceToInput(123456)).toBe("1.234,56");
    expect(priceToInput(null)).toBe("");
  });
});

describe("busca no catálogo", () => {
  const list = [{ name: "Criação de logo" }, { name: "Site institucional" }];

  it("pelo nome, sem acentos nem maiúsculas", () => {
    expect(searchCatalogItems(list, "CRIACAO")).toEqual([{ name: "Criação de logo" }]);
    expect(searchCatalogItems(list, " ")).toHaveLength(2);
    expect(searchCatalogItems(list, "zzz")).toEqual([]);
  });
});
