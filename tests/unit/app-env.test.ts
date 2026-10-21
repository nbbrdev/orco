import { describe, expect, it } from "vitest";

import { getAppEnv } from "@/lib/app-env";

describe("getAppEnv", () => {
  it("defaults to development when unset or empty", () => {
    expect(getAppEnv(undefined)).toBe("development");
    expect(getAppEnv("")).toBe("development");
  });

  it.each(["development", "production"] as const)("accepts %s", (value) => {
    expect(getAppEnv(value)).toBe(value);
  });

  // "staging" deixou de existir em 2026-10-21 (ADR-0017): um .env antigo com ele falha na subida.
  it.each(["prod", "staging", "preview"])("rejects %s", (value) => {
    expect(() => getAppEnv(value)).toThrow(/APP_ENV inválido/);
  });
});
