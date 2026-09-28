import { describe, expect, it } from "vitest";

import {
  addDays,
  defaultValidUntil,
  formatDateBR,
  isExpired,
  todayInAppTimeZone,
} from "@/lib/dates";

// São Paulo é UTC−3 (sem horário de verão desde 2019).
const at = (iso: string) => new Date(iso);

describe("todayInAppTimeZone", () => {
  it("uses the São Paulo day, not the UTC day", () => {
    // 02:30 UTC de 28/09 = 23:30 de 27/09 em São Paulo
    expect(todayInAppTimeZone(at("2026-09-28T02:30:00Z"))).toBe("2026-09-27");
    expect(todayInAppTimeZone(at("2026-09-28T03:00:00Z"))).toBe("2026-09-28");
  });

  it("defaults to the current time", () => {
    expect(todayInAppTimeZone()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addDays", () => {
  it.each([
    ["2026-09-28", 15, "2026-10-13"],
    ["2026-12-25", 10, "2027-01-04"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-09-28", 0, "2026-09-28"],
  ])("%s + %i days = %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });

  it.each(["2026-02-30", "2026-9-1", "28/09/2026", "abc"])("rejects invalid date %s", (date) => {
    expect(() => addDays(date, 1)).toThrow(RangeError);
  });

  it("rejects non-integer days", () => {
    expect(() => addDays("2026-09-28", 1.5)).toThrow(RangeError);
  });
});

describe("defaultValidUntil (RN-19)", () => {
  it("is today in São Paulo plus the profile validity", () => {
    expect(defaultValidUntil(15, at("2026-09-28T02:30:00Z"))).toBe("2026-10-12");
    expect(defaultValidUntil(15, at("2026-09-28T12:00:00Z"))).toBe("2026-10-13");
  });

  it("defaults to the current time", () => {
    expect(defaultValidUntil(1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each([0, 366, 1.5])("rejects validity of %s days", (days) => {
    expect(() => defaultValidUntil(days)).toThrow(RangeError);
  });
});

describe("isExpired (RN-26)", () => {
  it("is still valid during the whole last day in São Paulo", () => {
    // 12/10 às 23:59 em São Paulo = 13/10 02:59 UTC
    expect(isExpired("2026-10-12", at("2026-10-13T02:59:00Z"))).toBe(false);
  });

  it("expires when the next day starts in São Paulo", () => {
    expect(isExpired("2026-10-12", at("2026-10-13T03:00:00Z"))).toBe(true);
  });

  it("is not expired before the validity date", () => {
    expect(isExpired("2026-10-12", at("2026-09-28T12:00:00Z"))).toBe(false);
  });

  it("defaults to the current time", () => {
    expect(isExpired("2000-01-01")).toBe(true);
  });

  it("rejects an invalid validity date", () => {
    expect(() => isExpired("2026-13-01")).toThrow(RangeError);
  });
});

describe("formatDateBR", () => {
  it("formats as dd/mm/aaaa", () => {
    expect(formatDateBR("2026-10-02")).toBe("02/10/2026");
  });
});
