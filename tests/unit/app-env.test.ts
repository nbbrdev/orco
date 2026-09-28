import { describe, expect, it } from "vitest";

import { getAppEnv } from "@/lib/app-env";

describe("getAppEnv", () => {
  it("defaults to development when unset or empty", () => {
    expect(getAppEnv(undefined)).toBe("development");
    expect(getAppEnv("")).toBe("development");
  });

  it.each(["development", "staging", "production"] as const)("accepts %s", (value) => {
    expect(getAppEnv(value)).toBe(value);
  });

  it.each(["prod", "Staging", "preview"])("rejects %s", (value) => {
    expect(() => getAppEnv(value)).toThrow(/APP_ENV inválido/);
  });
});
