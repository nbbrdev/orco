import { describe, expect, it } from "vitest";

import { buildCsp, createNonce } from "@/lib/security/csp";

function directive(csp: string, name: string): string | undefined {
  return csp.split("; ").find((part) => part === name || part.startsWith(`${name} `));
}

describe("createNonce", () => {
  it("creates a different base64 value on each call", () => {
    const first = createNonce();
    const second = createNonce();
    expect(first).not.toBe(second);
    expect(Buffer.from(first, "base64")).toHaveLength(16);
  });
});

describe("buildCsp", () => {
  const production = buildCsp({ nonce: "abc123", appEnv: "production" });
  const development = buildCsp({ nonce: "abc123", appEnv: "development" });

  it("only allows scripts carrying the request nonce", () => {
    const scriptSrc = directive(production, "script-src");
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    // Nenhuma origem de terceiros (ex.: CAPTCHA externo), só o próprio app.
    expect(scriptSrc).not.toMatch(/https?:/);
  });

  it("allows eval only in development", () => {
    expect(directive(production, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
  });

  it("lets the browser talk only to the app itself", () => {
    expect(directive(production, "connect-src")).toBe("connect-src 'self'");
    expect(directive(production, "img-src")).toBe("img-src 'self' data: blob:");
  });

  it("blocks framing, plugins and foreign form targets", () => {
    expect(directive(production, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(production, "frame-src")).toBe("frame-src 'none'");
    expect(directive(production, "object-src")).toBe("object-src 'none'");
    expect(directive(production, "form-action")).toBe("form-action 'self'");
    expect(directive(production, "base-uri")).toBe("base-uri 'self'");
  });

  it("upgrades insecure requests only outside development", () => {
    expect(directive(production, "upgrade-insecure-requests")).toBeDefined();
    expect(
      directive(buildCsp({ nonce: "n", appEnv: "staging" }), "upgrade-insecure-requests"),
    ).toBeDefined();
    expect(directive(development, "upgrade-insecure-requests")).toBeUndefined();
  });
});
