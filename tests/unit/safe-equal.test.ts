import { describe, expect, it } from "vitest";

import { safeEqual } from "@/lib/security/safe-equal";

// Comparação em tempo constante do segredo do agendamento diário (NBB-62).
describe("safeEqual", () => {
  it("accepts equal texts, including accents and special characters", () => {
    expect(safeEqual("Bearer s3nha:ção", "Bearer s3nha:ção")).toBe(true);
  });

  it("rejects different texts, even with different lengths", () => {
    expect(safeEqual("Bearer s3nha", "Bearer s3nhA")).toBe(false);
    expect(safeEqual("Bearer s3nha", "Bearer s3nha-mais-longa")).toBe(false);
    expect(safeEqual("", "Bearer s3nha")).toBe(false);
  });
});
