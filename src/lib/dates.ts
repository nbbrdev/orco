/**
 * Datas do Orçô no fuso de São Paulo (RN-19, RN-26).
 *
 * Datas de calendário (ex.: validade) são texto ISO `AAAA-MM-DD`, igual à coluna `date`
 * do Postgres. "Hoje" é sempre o dia em America/Sao_Paulo, independente do fuso do
 * servidor (containers costumam rodar em UTC) ou do navegador.
 */

export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Data de calendário no formato ISO `AAAA-MM-DD`. */
export type IsoDate = string;

export const MIN_VALIDITY_DAYS = 1;
export const MAX_VALIDITY_DAYS = 365;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// "en-CA" formata como AAAA-MM-DD.
const isoDateInAppTimeZone = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const match = ISO_DATE_PATTERN.exec(date);
  if (match) {
    const [, year, month, day] = match.map(Number) as [number, number, number, number];
    const utc = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
    if (isRealDate) return { year, month, day };
  }
  throw new RangeError(`invalid ISO date "${date}" (expected AAAA-MM-DD)`);
}

/** Dia atual em São Paulo. */
export function todayInAppTimeZone(now: Date = new Date()): IsoDate {
  return isoDateInAppTimeZone.format(now);
}

/** Soma (ou subtrai) dias a uma data de calendário. */
export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError(`days must be an integer, got ${days}`);
  }
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Validade padrão de um novo orçamento: hoje + N dias do perfil (RN-19, padrão 15). */
export function defaultValidUntil(validityDays: number, now: Date = new Date()): IsoDate {
  if (
    !Number.isSafeInteger(validityDays) ||
    validityDays < MIN_VALIDITY_DAYS ||
    validityDays > MAX_VALIDITY_DAYS
  ) {
    throw new RangeError(
      `validityDays must be between ${MIN_VALIDITY_DAYS} and ${MAX_VALIDITY_DAYS}, got ${validityDays}`,
    );
  }
  return addDays(todayInAppTimeZone(now), validityDays);
}

/**
 * Um orçamento vence depois do fim do dia da validade (inclusiva) em São Paulo (RN-26):
 * com validade 12/10, ainda vale durante todo o dia 12/10 e expira a partir de 13/10.
 */
export function isExpired(validUntil: IsoDate, now: Date = new Date()): boolean {
  parseIsoDate(validUntil);
  return validUntil < todayInAppTimeZone(now);
}

/** "2026-10-12" → "12/10/2026". */
export function formatDateBR(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
