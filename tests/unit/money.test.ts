import { describe, expect, it } from "vitest";

import {
  MAX_QUANTITY_MILLI,
  calculateDiscountCents,
  calculateLine,
  calculateQuote,
  formatBRL,
  formatBRLInput,
  formatPercent,
  formatQuantity,
  numericToQuantity,
  parseBRL,
  parsePercent,
  parseQuantity,
  quantityToNumeric,
} from "@/lib/money";

describe("calculateLine (RN-15)", () => {
  it("multiplies quantity by unit price", () => {
    expect(calculateLine({ quantityMilli: 2000, unitPriceCents: 80000 })).toEqual({
      grossCents: 160000,
      discountCents: 0,
      totalCents: 160000,
    });
  });

  it("rounds half up to the cent (1,5 h × R$ 33,33 = R$ 49,995 → R$ 50,00)", () => {
    expect(calculateLine({ quantityMilli: 1500, unitPriceCents: 3333 }).grossCents).toBe(5000);
  });

  it("rounds down below the half cent (0,001 × R$ 4,99 = R$ 0,00499 → R$ 0,00)", () => {
    expect(calculateLine({ quantityMilli: 1, unitPriceCents: 499 }).grossCents).toBe(0);
  });

  it("applies a percent item discount on the gross value (RN-15a)", () => {
    expect(
      calculateLine({
        quantityMilli: 1000,
        unitPriceCents: 80000,
        discount: { type: "percent", basisPoints: 1000 },
      }),
    ).toEqual({ grossCents: 80000, discountCents: 8000, totalCents: 72000 });
  });

  it("caps a fixed item discount at the gross value", () => {
    expect(
      calculateLine({
        quantityMilli: 1000,
        unitPriceCents: 5000,
        discount: { type: "amount", cents: 9000 },
      }),
    ).toEqual({ grossCents: 5000, discountCents: 5000, totalCents: 0 });
  });

  it("accepts the largest numeric(12,3) quantity", () => {
    expect(calculateLine({ quantityMilli: MAX_QUANTITY_MILLI, unitPriceCents: 1 }).grossCents).toBe(
      1_000_000_000,
    );
  });

  it.each([
    { quantityMilli: -1, unitPriceCents: 100 },
    { quantityMilli: 1.5, unitPriceCents: 100 },
    { quantityMilli: 1000, unitPriceCents: -1 },
    { quantityMilli: MAX_QUANTITY_MILLI + 1, unitPriceCents: 100 },
  ])("rejects invalid input %o", (input) => {
    expect(() => calculateLine(input)).toThrow(RangeError);
  });

  it("rejects results beyond the safe integer range", () => {
    expect(() =>
      calculateLine({ quantityMilli: MAX_QUANTITY_MILLI, unitPriceCents: Number.MAX_SAFE_INTEGER }),
    ).toThrow(RangeError);
  });
});

describe("calculateDiscountCents (RN-15a, RN-17)", () => {
  it("returns zero without a discount", () => {
    expect(calculateDiscountCents(1000)).toBe(0);
    expect(calculateDiscountCents(1000, null)).toBe(0);
  });

  it("rounds percent discounts half up to the cent", () => {
    // 12,5% de R$ 0,99 = R$ 0,12375 → R$ 0,12
    expect(calculateDiscountCents(99, { type: "percent", basisPoints: 1250 })).toBe(12);
    // 50% de R$ 0,01 = R$ 0,005 → R$ 0,01
    expect(calculateDiscountCents(1, { type: "percent", basisPoints: 5000 })).toBe(1);
  });

  it("allows 0% and 100%", () => {
    expect(calculateDiscountCents(1000, { type: "percent", basisPoints: 0 })).toBe(0);
    expect(calculateDiscountCents(1000, { type: "percent", basisPoints: 10000 })).toBe(1000);
  });

  it.each([
    { base: -1, discount: undefined },
    { base: 1000, discount: { type: "percent" as const, basisPoints: 10001 } },
    { base: 1000, discount: { type: "percent" as const, basisPoints: -1 } },
    { base: 1000, discount: { type: "amount" as const, cents: -1 } },
    { base: 1000, discount: { type: "amount" as const, cents: 0.5 } },
  ])("rejects invalid input %o", ({ base, discount }) => {
    expect(() => calculateDiscountCents(base, discount)).toThrow(RangeError);
  });
});

describe("calculateQuote (RN-16 a RN-18)", () => {
  it("matches the RN-16 example: R$ 2.720,00 − R$ 220,00 = R$ 2.500,00", () => {
    const totals = calculateQuote(
      [
        {
          quantityMilli: 1000,
          unitPriceCents: 80000,
          discount: { type: "percent", basisPoints: 1000 },
        },
        { quantityMilli: 1000, unitPriceCents: 200000 },
      ],
      { type: "amount", cents: 22000 },
    );

    expect(totals.lines.map((line) => line.totalCents)).toEqual([72000, 200000]);
    expect(totals.subtotalCents).toBe(272000);
    expect(totals.discountCents).toBe(22000);
    expect(totals.totalCents).toBe(250000);
  });

  it("never goes below zero with a general discount larger than the subtotal", () => {
    const totals = calculateQuote([{ quantityMilli: 1000, unitPriceCents: 1000 }], {
      type: "amount",
      cents: 5000,
    });
    expect(totals.totalCents).toBe(0);
  });

  it("returns zeros for an empty quote", () => {
    expect(calculateQuote([])).toEqual({
      lines: [],
      subtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
    });
  });
});

describe("formatting", () => {
  it("formats cents as BRL with a non-breaking space", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("rejects non-integer cents", () => {
    expect(() => formatBRL(1.5)).toThrow(RangeError);
  });

  it("formats quantities and percents in pt-BR", () => {
    expect(formatQuantity(1500)).toBe("1,5");
    expect(formatQuantity(1234567)).toBe("1.234,567");
    expect(formatPercent(1050)).toBe("10,5%");
    expect(formatPercent(1000)).toBe("10%");
  });
});

describe("parseBRL", () => {
  it.each([
    ["R$ 1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1234,5", 123450],
    ["10", 1000],
    [" 0,99 ", 99],
    ["1.000.000", 100000000],
  ])("parses %s", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1,234.56", "12,345", "1.23", "1.2345", "99999999999999999"])(
    "rejects %s",
    (input) => {
      expect(parseBRL(input)).toBeNull();
    },
  );

  it("round-trips with formatBRL", () => {
    expect(parseBRL(formatBRL(250000))).toBe(250000);
  });
});

describe("parseQuantity", () => {
  it.each([
    ["1,5", 1500],
    ["2", 2000],
    ["0,001", 1],
    ["1.000,25", 1000250],
  ])("parses %s", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  it.each(["0", "0,000", "1,2345", "-1", "1000000000", "x"])("rejects %s", (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe("parsePercent", () => {
  it.each([
    ["10,5", 1050],
    ["10,5%", 1050],
    ["100", 10000],
    ["0", 0],
  ])("parses %s", (input, expected) => {
    expect(parsePercent(input)).toBe(expected);
  });

  it.each(["100,01", "abc", "-10", "10,555"])("rejects %s", (input) => {
    expect(parsePercent(input)).toBeNull();
  });
});

describe("formatBRLInput (NBB-86)", () => {
  it("formats without the R$ prefix", () => {
    expect(formatBRLInput(123456)).toBe("1.234,56");
    expect(formatBRLInput(0)).toBe("0,00");
  });
});

describe("quantity in the database, numeric(12,3) (ADR-0006, NBB-86)", () => {
  it.each([
    [1500, "1.500"],
    [1000, "1.000"],
    [1, "0.001"],
    [0, "0.000"],
    [MAX_QUANTITY_MILLI, "999999999.999"],
  ])("milli %i → %s and back", (milli, text) => {
    expect(quantityToNumeric(milli)).toBe(text);
    expect(numericToQuantity(text)).toBe(milli);
  });

  it("accepts numeric text with fewer decimals", () => {
    expect(numericToQuantity("2")).toBe(2000);
    expect(numericToQuantity("1.5")).toBe(1500);
  });

  it("rejects invalid values", () => {
    expect(() => quantityToNumeric(-1)).toThrow(RangeError);
    expect(() => quantityToNumeric(1.5)).toThrow(RangeError);
    expect(() => quantityToNumeric(MAX_QUANTITY_MILLI + 1)).toThrow(RangeError);
    expect(() => numericToQuantity("1,5")).toThrow(RangeError);
    expect(() => numericToQuantity("-1")).toThrow(RangeError);
    expect(() => numericToQuantity("1.5555")).toThrow(RangeError);
  });
});
