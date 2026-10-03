import { describe, expect, it } from "vitest";

import {
  formatQuoteNumber,
  itemsTotal,
  lineTotals,
  newItemDraft,
  parseItem,
  toItemDraft,
} from "@/features/quotes/items";
import { saveItemsSchema } from "@/features/quotes/schemas";

// Itens do editor de orçamento (F-05, NBB-86): conferência dos campos (P3-A), totais e conversões.

const draft = (values: Partial<Parameters<typeof parseItem>[0]> = {}) => ({
  id: "6f9c2f5e-0b1a-4f7a-9d4e-1c2b3a4d5e6f",
  description: "Logo",
  quantity: "1",
  unitPrice: "800",
  ...values,
});

describe("parseItem", () => {
  it("converte quantidade em milésimos e valor em centavos", () => {
    expect(
      parseItem(draft({ description: " Logo ", quantity: "1,5", unitPrice: "1.234,56" })),
    ).toEqual({
      ok: true,
      item: {
        id: draft().id,
        description: "Logo",
        quantityMilli: 1500,
        unitPriceCents: 123456,
      },
    });
  });

  it("no rascunho, descrição e valor podem ficar vazios (RN-13)", () => {
    const result = parseItem(draft({ description: "", unitPrice: "" }));
    expect(result).toMatchObject({ ok: true, item: { description: "", unitPriceCents: null } });
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

  it("recusa descrição longa demais", () => {
    expect(parseItem(draft({ description: "a".repeat(501) }))).toEqual({
      ok: false,
      errors: { description: "Use até 500 caracteres." },
    });
  });
});

describe("totais (RN-15, RN-16)", () => {
  const parsed = (values: Partial<Parameters<typeof parseItem>[0]>) => {
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
  it("item novo: vazio, quantidade 1 e um id próprio", () => {
    const first = newItemDraft();
    expect(first).toMatchObject({ description: "", quantity: "1", unitPrice: "" });
    expect(first.id).not.toBe(newItemDraft().id);
  });

  it("item salvo volta para os campos no formato brasileiro", () => {
    expect(
      toItemDraft({ id: "x", description: "Site", quantityMilli: 1500, unitPriceCents: 200000 }),
    ).toEqual({ id: "x", description: "Site", quantity: "1,5", unitPrice: "2.000,00" });
    expect(
      toItemDraft({ id: "x", description: "", quantityMilli: 1000, unitPriceCents: null })
        .unitPrice,
    ).toBe("");
  });

  it("número do orçamento com 4 dígitos (RN-12)", () => {
    expect(formatQuoteNumber(1)).toBe("0001");
    expect(formatQuoteNumber(12345)).toBe("12345");
  });
});

describe("saveItemsSchema", () => {
  it("recusa ids repetidos e mais de 100 itens", () => {
    expect(saveItemsSchema.safeParse({ items: [draft(), draft()] }).success).toBe(false);
    const many = Array.from({ length: 101 }, () => ({ ...draft(), id: crypto.randomUUID() }));
    expect(saveItemsSchema.safeParse({ items: many }).success).toBe(false);
  });
});
