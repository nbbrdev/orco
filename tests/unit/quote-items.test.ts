import { describe, expect, it } from "vitest";

import {
  type CatalogSuggestion,
  describeDiscount,
  fillFromCatalog,
  formatQuoteNumber,
  isDiscountCapped,
  type ItemDraft,
  lineTotals,
  NO_DISCOUNT,
  newItemDraft,
  type OptionsDraft,
  parseDiscount,
  parseItem,
  parseOptions,
  quoteTotals,
  suggestFromCatalog,
  toDiscountDraft,
  toItemDraft,
  toMoneyDiscount,
  toOptionsDraft,
} from "@/features/quotes/items";
import { saveItemsSchema } from "@/features/quotes/schemas";

// Itens e opções do editor de orçamento (F-05, NBB-86/87/88): conferência dos campos (P3-A), totais
// com descontos, conversões, unidade (C5-A), sugestões do catálogo (C6-A) e "Mais opções" (G2-A).

const draft = (values: Partial<ItemDraft> = {}): ItemDraft => ({
  id: "6f9c2f5e-0b1a-4f7a-9d4e-1c2b3a4d5e6f",
  description: "Logo",
  quantity: "1",
  unit: "",
  unitPrice: "800",
  catalogItemId: null,
  discount: NO_DISCOUNT,
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
        discount: { type: null, value: 0 },
      },
    });
  });

  it("converte o desconto do item: % em pontos-base, R$ em centavos (G1-A)", () => {
    const percent = parseItem(draft({ discount: { type: "percent", value: "10,5" } }));
    expect(percent.ok && percent.item.discount).toEqual({ type: "percent", value: 1050 });
    const amount = parseItem(draft({ discount: { type: "amount", value: "80" } }));
    expect(amount.ok && amount.item.discount).toEqual({ type: "amount", value: 8000 });
  });

  it("recusa desconto inválido", () => {
    expect(parseItem(draft({ discount: { type: "percent", value: "101" } }))).toEqual({
      ok: false,
      errors: { discount: "Informe um percentual de 0 a 100, ex.: 10 ou 10,5" },
    });
    expect(parseItem(draft({ discount: { type: "amount", value: "dez" } }))).toEqual({
      ok: false,
      errors: { discount: "Informe um valor válido, ex.: 1.234,56" },
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

describe("parseDiscount", () => {
  it("sem tipo ou com valor vazio, é sem desconto", () => {
    const none = { ok: true, discount: { type: null, value: 0 } };
    expect(parseDiscount(NO_DISCOUNT)).toEqual(none);
    expect(parseDiscount({ type: "percent", value: "  " })).toEqual(none);
  });

  it("aceita % com o símbolo e R$ com milhar", () => {
    expect(parseDiscount({ type: "percent", value: "10%" })).toEqual({
      ok: true,
      discount: { type: "percent", value: 1000 },
    });
    expect(parseDiscount({ type: "amount", value: "1.234,56" })).toEqual({
      ok: true,
      discount: { type: "amount", value: 123456 },
    });
  });
});

describe("totais (RN-15 a RN-18)", () => {
  const parsed = (values: Partial<ItemDraft>) => {
    const result = parseItem(draft(values));
    if (!result.ok) throw new Error("item inválido");
    return result.item;
  };

  it("linha = quantidade × valor; sem valor, zero", () => {
    expect(lineTotals(parsed({ quantity: "1,5", unitPrice: "100" })).totalCents).toBe(15000);
    expect(lineTotals(parsed({ unitPrice: "" })).totalCents).toBe(0);
  });

  it("o desconto do item sai da linha (RN-15a)", () => {
    expect(
      lineTotals(parsed({ unitPrice: "800", discount: { type: "percent", value: "10" } })),
    ).toEqual({ grossCents: 80000, discountCents: 8000, totalCents: 72000 });
  });

  it("exemplo da RN-16: itens com desconto e desconto geral", () => {
    const totals = quoteTotals(
      [
        parsed({ unitPrice: "800", discount: { type: "percent", value: "10" } }),
        parsed({ unitPrice: "2.000" }),
        parsed({ unitPrice: "" }),
      ],
      { type: "amount", value: 22000 },
    );
    expect(totals).toMatchObject({
      subtotalCents: 272000,
      discountCents: 22000,
      totalCents: 250000,
    });
    expect(quoteTotals([], { type: null, value: 0 }).totalCents).toBe(0);
  });

  it("desconto em R$ maior que a base fica limitado a ela (G6-A)", () => {
    const line = parsed({ unitPrice: "50", discount: { type: "amount", value: "80" } });
    expect(lineTotals(line)).toEqual({ grossCents: 5000, discountCents: 5000, totalCents: 0 });
    expect(isDiscountCapped(line.discount, 5000)).toBe(true);
    expect(isDiscountCapped({ type: "amount", value: 5000 }, 5000)).toBe(false);
    expect(isDiscountCapped({ type: "percent", value: 10000 }, 0)).toBe(false);
  });
});

describe("descontos na tela", () => {
  it("descreve o desconto ao lado do total", () => {
    expect(describeDiscount({ type: "percent", value: 1000 }, 8000)).toBe("−10%");
    expect(describeDiscount({ type: "amount", value: 9000 }, 5000)).toMatch(/^−R\$\s50,00$/u);
    expect(describeDiscount({ type: "percent", value: 1000 }, 0)).toBe("");
    expect(describeDiscount({ type: null, value: 0 }, 0)).toBe("");
  });

  it("converte entre o banco, o money.ts e o campo", () => {
    expect(toMoneyDiscount({ type: "percent", value: 1050 })).toEqual({
      type: "percent",
      basisPoints: 1050,
    });
    expect(toMoneyDiscount({ type: "amount", value: 8000 })).toEqual({
      type: "amount",
      cents: 8000,
    });
    expect(toMoneyDiscount({ type: null, value: 0 })).toBeNull();
    expect(toDiscountDraft({ type: "percent", value: 1050 })).toEqual({
      type: "percent",
      value: "10,5",
    });
    expect(toDiscountDraft({ type: "amount", value: 8000 })).toEqual({
      type: "amount",
      value: "80,00",
    });
    expect(toDiscountDraft({ type: null, value: 0 })).toEqual(NO_DISCOUNT);
  });
});

describe("parseOptions (G2-A)", () => {
  const options = (values: Partial<OptionsDraft> = {}): OptionsDraft => ({
    discount: NO_DISCOUNT,
    validUntil: "2026-10-18",
    paymentTerms: " 50% na entrada ",
    deliveryTime: "",
    notes: "",
    internalNotes: "",
    ...values,
  });

  it("converte e troca texto vazio por nulo", () => {
    expect(parseOptions(options({ discount: { type: "percent", value: "5" } }))).toEqual({
      ok: true,
      options: {
        discount: { type: "percent", value: 500 },
        validUntil: "2026-10-18",
        paymentTerms: "50% na entrada",
        deliveryTime: null,
        notes: null,
        internalNotes: null,
      },
    });
  });

  it("a validade é obrigatória e precisa ser uma data real (G5-A)", () => {
    expect(parseOptions(options({ validUntil: "" }))).toEqual({
      ok: false,
      errors: { validUntil: "Informe a validade." },
    });
    expect(parseOptions(options({ validUntil: "2026-02-30" }))).toEqual({
      ok: false,
      errors: { validUntil: "Informe uma data válida." },
    });
  });

  it("aceita validade no passado (G5-A: só avisa)", () => {
    expect(parseOptions(options({ validUntil: "2020-01-01" })).ok).toBe(true);
  });

  it("recusa desconto inválido e textos longos demais", () => {
    expect(
      parseOptions(options({ discount: { type: "amount", value: "x" }, notes: "a".repeat(2001) })),
    ).toEqual({
      ok: false,
      errors: {
        discount: "Informe um valor válido, ex.: 1.234,56",
        notes: "Use até 2000 caracteres.",
      },
    });
  });

  it("opções salvas voltam para os campos", () => {
    expect(
      toOptionsDraft({
        discount: { type: "amount", value: 2000 },
        validUntil: "2026-10-18",
        paymentTerms: null,
        deliveryTime: "15 dias",
        notes: null,
        internalNotes: "Cliente antigo",
      }),
    ).toEqual({
      discount: { type: "amount", value: "20,00" },
      validUntil: "2026-10-18",
      paymentTerms: "",
      deliveryTime: "15 dias",
      notes: "",
      internalNotes: "Cliente antigo",
    });
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
      discount: NO_DISCOUNT,
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
        discount: { type: "percent", value: 1000 },
      }),
    ).toEqual({
      id: "x",
      description: "Site",
      quantity: "1,5",
      unit: "h",
      unitPrice: "2.000,00",
      catalogItemId: "c",
      discount: { type: "percent", value: "10" },
    });
    expect(
      toItemDraft({
        id: "x",
        description: "",
        quantityMilli: 1000,
        unit: null,
        unitPriceCents: null,
        catalogItemId: null,
        discount: { type: null, value: 0 },
      }),
    ).toMatchObject({ unit: "", unitPrice: "", discount: NO_DISCOUNT });
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

  it("item sem desconto vale como sem desconto; as opções são opcionais", () => {
    // Como mandaria uma aba aberta antes da NBB-88, sem o campo do desconto.
    const withoutDiscount: Partial<ItemDraft> = draft();
    delete withoutDiscount.discount;
    const parsed = saveItemsSchema.safeParse({ items: [withoutDiscount] });
    expect(parsed.success && parsed.data.items[0]?.discount).toEqual(NO_DISCOUNT);
    expect(parsed.success && parsed.data.options).toBeUndefined();
  });
});
