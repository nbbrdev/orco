import { describe, expect, it } from "vitest";

import {
  type CatalogSuggestion,
  fillFromCatalog,
  formatQuoteNumber,
  type ItemDraft,
  itemsTotal,
  lineTotals,
  newItemDraft,
  parseItem,
  suggestFromCatalog,
  toItemDraft,
} from "@/features/quotes/items";
import { saveItemsSchema } from "@/features/quotes/schemas";

// Itens do editor de orçamento (F-05, NBB-86/87): conferência dos campos (P3-A), totais, conversões,
// unidade (C5-A) e sugestões do catálogo (C6-A).

const draft = (values: Partial<ItemDraft> = {}): ItemDraft => ({
  id: "6f9c2f5e-0b1a-4f7a-9d4e-1c2b3a4d5e6f",
  description: "Logo",
  quantity: "1",
  unit: "",
  unitPrice: "800",
  catalogItemId: null,
  ...values,
});

describe("parseItem", () => {
  it("converte quantidade em milésimos e valor em centavos", () => {
    expect(
      parseItem(
        draft({ description: " Logo ", quantity: "1,5", unit: " h ", unitPrice: "1.234,56" }),
      ),
    ).toEqual({
      ok: true,
      item: {
        id: draft().id,
        description: "Logo",
        quantityMilli: 1500,
        unit: "h",
        unitPriceCents: 123456,
        catalogItemId: null,
      },
    });
  });

  it("no rascunho, descrição, unidade e valor podem ficar vazios (RN-13)", () => {
    const result = parseItem(draft({ description: "", unit: "", unitPrice: "" }));
    expect(result).toMatchObject({
      ok: true,
      item: { description: "", unit: null, unitPriceCents: null },
    });
  });

  it("a quantidade precisa existir e ser maior que zero (RN-14)", () => {
    expect(parseItem(draft({ quantity: "" }))).toEqual({
      ok: false,
      errors: { quantity: "Informe a quantidade." },
    });
    for (const quantity of ["0", "abc", "1,5555"]) {
      expect(parseItem(draft({ quantity }))).toEqual({
        ok: false,
        errors: { quantity: "Informe uma quantidade válida, ex.: 1,5" },
      });
    }
  });

  it("recusa valor inválido ou acima do teto", () => {
    expect(parseItem(draft({ unitPrice: "oitocentos" }))).toEqual({
      ok: false,
      errors: { unitPrice: "Informe um valor válido, ex.: 1.234,56" },
    });
    const tooHigh = parseItem(draft({ unitPrice: "10.000.000" }));
    expect(tooHigh.ok ? "" : tooHigh.errors.unitPrice).toMatch(
      /^O valor pode ser de até R\$\s9\.999\.999,99\.$/u,
    );
  });

  it("recusa descrição ou unidade longas demais", () => {
    expect(parseItem(draft({ description: "a".repeat(501) }))).toEqual({
      ok: false,
      errors: { description: "Use até 500 caracteres." },
    });
    expect(parseItem(draft({ unit: "a".repeat(11) }))).toEqual({
      ok: false,
      errors: { unit: "Use até 10 caracteres." },
    });
  });
});

describe("totais (RN-15, RN-16)", () => {
  const parsed = (values: Partial<ItemDraft>) => {
    const result = parseItem(draft(values));
    if (!result.ok) throw new Error("item inválido");
    return result.item;
  };

  it("linha = quantidade × valor; sem valor, zero", () => {
    expect(lineTotals(parsed({ quantity: "1,5", unitPrice: "100" })).totalCents).toBe(15000);
    expect(lineTotals(parsed({ unitPrice: "" })).totalCents).toBe(0);
  });

  it("total = soma das linhas (exemplo da RN-16, sem descontos)", () => {
    expect(
      itemsTotal([
        parsed({ unitPrice: "800" }),
        parsed({ unitPrice: "2.000" }),
        parsed({ unitPrice: "" }),
      ]),
    ).toBe(280000);
    expect(itemsTotal([])).toBe(0);
  });
});

describe("conversões", () => {
  it("item novo: vazio, quantidade 1, sem catálogo e um id próprio", () => {
    const first = newItemDraft();
    expect(first).toMatchObject({
      description: "",
      quantity: "1",
      unit: "",
      unitPrice: "",
      catalogItemId: null,
    });
    expect(first.id).not.toBe(newItemDraft().id);
  });

  it("item salvo volta para os campos no formato brasileiro", () => {
    expect(
      toItemDraft({
        id: "x",
        description: "Site",
        quantityMilli: 1500,
        unit: "h",
        unitPriceCents: 200000,
        catalogItemId: "c",
      }),
    ).toEqual({
      id: "x",
      description: "Site",
      quantity: "1,5",
      unit: "h",
      unitPrice: "2.000,00",
      catalogItemId: "c",
    });
    expect(
      toItemDraft({
        id: "x",
        description: "",
        quantityMilli: 1000,
        unit: null,
        unitPriceCents: null,
        catalogItemId: null,
      }),
    ).toMatchObject({ unit: "", unitPrice: "" });
  });

  it("número do orçamento com 4 dígitos (RN-12)", () => {
    expect(formatQuoteNumber(1)).toBe("0001");
    expect(formatQuoteNumber(12345)).toBe("12345");
  });
});

describe("catálogo no editor (C6-A)", () => {
  const catalog: CatalogSuggestion[] = [
    { id: "1", name: "Criação de logo", unit: "un", unitPriceCents: 80000 },
    { id: "2", name: "Hora de consultoria", unit: "h", unitPriceCents: null },
    { id: "3", name: "Site institucional", unit: null, unitPriceCents: 200000 },
  ];

  it("sugere pelo nome, sem acentos nem maiúsculas, até o limite", () => {
    expect(suggestFromCatalog(catalog, "CRIACAO").map((entry) => entry.id)).toEqual(["1"]);
    expect(suggestFromCatalog(catalog, "o", 2)).toHaveLength(2);
    expect(suggestFromCatalog(catalog, "  ")).toEqual([]);
  });

  it("escolher preenche descrição, unidade e valor e guarda a origem", () => {
    const filled = fillFromCatalog(draft({ quantity: "2" }), catalog[0] as CatalogSuggestion);
    expect(filled).toMatchObject({
      description: "Criação de logo",
      quantity: "2",
      unit: "un",
      unitPrice: "800,00",
      catalogItemId: "1",
    });
    expect(fillFromCatalog(draft(), catalog[1] as CatalogSuggestion)).toMatchObject({
      unit: "h",
      unitPrice: "",
    });
    expect(fillFromCatalog(draft(), catalog[2] as CatalogSuggestion).unit).toBe("");
  });
});

describe("saveItemsSchema", () => {
  it("recusa ids repetidos e mais de 100 itens", () => {
    expect(saveItemsSchema.safeParse({ items: [draft(), draft()] }).success).toBe(false);
    const many = Array.from({ length: 101 }, () => ({ ...draft(), id: crypto.randomUUID() }));
    expect(saveItemsSchema.safeParse({ items: many }).success).toBe(false);
  });
});
