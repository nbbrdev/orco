/**
 * Cálculo monetário do Orçô (ADR-0006, RN-14 a RN-18).
 *
 * - Dinheiro sempre em **centavos inteiros** (R$ 12,50 → 1250).
 * - Quantidade em **milésimos inteiros** (1,5 → 1500), espelhando `numeric(12,3)`.
 * - Percentual em **pontos-base** (10% → 1000; 0–10000).
 * - Arredondamento **meio-para-cima** ao centavo (R$ 49,995 → R$ 50,00).
 *
 * As multiplicações usam BigInt, então o cálculo nunca passa por ponto flutuante.
 * Esta é a ÚNICA implementação de cálculo: client, servidor e PDF usam este módulo.
 */

/** Valor monetário em centavos inteiros. */
export type Cents = number;
/** Quantidade em milésimos inteiros (1,5 → 1500). */
export type QuantityMilli = number;
/** Percentual em pontos-base (10,5% → 1050). */
export type BasisPoints = number;

export type Discount =
  { type: "percent"; basisPoints: BasisPoints } | { type: "amount"; cents: Cents };

export type LineInput = {
  quantityMilli: QuantityMilli;
  unitPriceCents: Cents;
  discount?: Discount | null;
};

export type LineTotals = {
  grossCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
};

export type QuoteTotals = {
  lines: LineTotals[];
  subtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
};

export const MAX_BASIS_POINTS: BasisPoints = 10_000;
/** Maior quantidade aceita por `numeric(12,3)`: 999.999.999,999. */
export const MAX_QUANTITY_MILLI: QuantityMilli = 999_999_999_999;

const MILLI_PER_UNIT = 1000n;
const BASIS_POINTS_PER_UNIT = 10_000n;

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer, got ${value}`);
  }
}

/** Divide com arredondamento meio-para-cima (numerador e denominador não negativos). */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`value ${value} exceeds the safe integer range`);
  }
  return Number(value);
}

/** Desconto em centavos sobre uma base (RN-15a, RN-17): nunca maior que a base. */
export function calculateDiscountCents(baseCents: Cents, discount?: Discount | null): Cents {
  assertNonNegativeInteger(baseCents, "baseCents");
  if (!discount) return 0;

  if (discount.type === "percent") {
    assertNonNegativeInteger(discount.basisPoints, "basisPoints");
    if (discount.basisPoints > MAX_BASIS_POINTS) {
      throw new RangeError(
        `basisPoints must be at most ${MAX_BASIS_POINTS}, got ${discount.basisPoints}`,
      );
    }
    return toSafeNumber(
      divideRoundHalfUp(BigInt(baseCents) * BigInt(discount.basisPoints), BASIS_POINTS_PER_UNIT),
    );
  }

  assertNonNegativeInteger(discount.cents, "discount.cents");
  return Math.min(discount.cents, baseCents);
}

/** Totais de uma linha (RN-15): bruto = arredonda(quantidade × valor unitário); total = bruto − desconto. */
export function calculateLine({ quantityMilli, unitPriceCents, discount }: LineInput): LineTotals {
  assertNonNegativeInteger(quantityMilli, "quantityMilli");
  assertNonNegativeInteger(unitPriceCents, "unitPriceCents");
  if (quantityMilli > MAX_QUANTITY_MILLI) {
    throw new RangeError(
      `quantityMilli must be at most ${MAX_QUANTITY_MILLI}, got ${quantityMilli}`,
    );
  }

  const grossCents = toSafeNumber(
    divideRoundHalfUp(BigInt(quantityMilli) * BigInt(unitPriceCents), MILLI_PER_UNIT),
  );
  const discountCents = calculateDiscountCents(grossCents, discount);
  return { grossCents, discountCents, totalCents: grossCents - discountCents };
}

/**
 * Totais do orçamento (RN-16 a RN-18): subtotal = soma dos totais das linhas;
 * desconto geral sobre o subtotal; total nunca negativo.
 */
export function calculateQuote(
  lines: readonly LineInput[],
  discount?: Discount | null,
): QuoteTotals {
  const lineTotals = lines.map(calculateLine);
  const subtotalCents = toSafeNumber(
    lineTotals.reduce((sum, line) => sum + BigInt(line.totalCents), 0n),
  );
  const discountCents = calculateDiscountCents(subtotalCents, discount);
  return {
    lines: lineTotals,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}

// ---------------------------------------------------------------------------
// Conversão de/para texto no formato brasileiro (só na borda: inputs e exibição).
// ---------------------------------------------------------------------------

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantityFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Formata centavos como moeda: 123456 → "R$ 1.234,56" (espaço não separável após "R$"). */
export function formatBRL(cents: Cents): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`cents must be a safe integer, got ${cents}`);
  }
  return brlFormatter.format(cents / 100);
}

/** Formata milésimos como quantidade: 1500 → "1,5". */
export function formatQuantity(quantityMilli: QuantityMilli): string {
  assertNonNegativeInteger(quantityMilli, "quantityMilli");
  return quantityFormatter.format(quantityMilli / 1000);
}

/** Formata pontos-base como percentual: 1050 → "10,5%". */
export function formatPercent(basisPoints: BasisPoints): string {
  assertNonNegativeInteger(basisPoints, "basisPoints");
  return `${percentFormatter.format(basisPoints / 100)}%`;
}

/**
 * Converte um número decimal no formato brasileiro em inteiro escalado.
 * Aceita "1.234,56" (com separador de milhar correto) ou "1234,56" e até `maxDecimals` casas.
 * Retorna `null` para qualquer texto inválido ou negativo.
 */
function parseBrazilianDecimal(input: string, maxDecimals: number): bigint | null {
  const text = input.trim();
  const pattern = new RegExp(`^(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d{1,${maxDecimals}}))?$`);
  const match = pattern.exec(text);
  if (!match) return null;

  const [, integerPart = "", fractionPart = ""] = match;
  const digits = integerPart.replaceAll(".", "") + fractionPart.padEnd(maxDecimals, "0");
  return BigInt(digits);
}

/** "R$ 1.234,56" / "1234,5" / "10" → centavos; `null` se inválido. */
export function parseBRL(input: string): Cents | null {
  // `\s` também cobre o espaço não separável que o Intl coloca após "R$".
  const value = parseBrazilianDecimal(input.replace(/^\s*R\$\s*/u, ""), 2);
  if (value === null || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

/** "1,5" → 1500 milésimos; `null` se inválido, zero ou acima de `numeric(12,3)`. */
export function parseQuantity(input: string): QuantityMilli | null {
  const value = parseBrazilianDecimal(input, 3);
  if (value === null || value === 0n || value > BigInt(MAX_QUANTITY_MILLI)) return null;
  return Number(value);
}

/** "10,5" ou "10,5%" → 1050 pontos-base; `null` se inválido ou acima de 100%. */
export function parsePercent(input: string): BasisPoints | null {
  const value = parseBrazilianDecimal(input.replace(/%\s*$/u, ""), 2);
  if (value === null || value > BigInt(MAX_BASIS_POINTS)) return null;
  return Number(value);
}
