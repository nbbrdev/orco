import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

function nonceOf(csp: string | null): string | undefined {
  return csp?.match(/'nonce-([^']+)'/)?.[1];
}

function request(path: string): NextRequest {
  return new NextRequest(`https://orco.nbbrdev.com${path}`);
}

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("content security policy", () => {
    it("sends a CSP with a fresh nonce on every response", async () => {
      vi.stubEnv("APP_ENV", "production");
      const first = nonceOf((await proxy(request("/"))).headers.get("Content-Security-Policy"));
      const second = nonceOf((await proxy(request("/"))).headers.get("Content-Security-Policy"));

      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first).not.toBe(second);
    });

    it("hands the same nonce to Next.js through the request headers", async () => {
      vi.stubEnv("APP_ENV", "production");
      const response = await proxy(request("/"));

      // O Next repassa os headers alterados da requisição por "x-middleware-request-<nome>".
      const responseNonce = nonceOf(response.headers.get("Content-Security-Policy"));
      expect(response.headers.get("x-middleware-request-x-nonce")).toBe(responseNonce);
      expect(nonceOf(response.headers.get("x-middleware-request-content-security-policy"))).toBe(
        responseNonce,
      );
    });
  });

  it("lets every request through, without blocking or noindex (no staging since ADR-0017)", async () => {
    vi.stubEnv("APP_ENV", "production");
    const response = await proxy(request("/app/orcamentos"));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });
});
