import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

function nonceOf(csp: string | null): string | undefined {
  return csp?.match(/'nonce-([^']+)'/)?.[1];
}

function request(path: string, credentials?: string): NextRequest {
  const headers = new Headers();
  if (credentials) {
    headers.set("authorization", `Basic ${Buffer.from(credentials).toString("base64")}`);
  }
  return new NextRequest(`https://staging.orco.nbbrdev.com${path}`, { headers });
}

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("STAGING_BASIC_AUTH_USER", "tester");
    vi.stubEnv("STAGING_BASIC_AUTH_PASSWORD", "s3nha");
  });

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

  it("does nothing outside staging", async () => {
    vi.stubEnv("APP_ENV", "production");
    const response = await proxy(request("/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });

  describe("in staging", () => {
    beforeEach(() => {
      vi.stubEnv("APP_ENV", "staging");
    });

    it("stays closed (503) when credentials are not configured", async () => {
      vi.stubEnv("STAGING_BASIC_AUTH_PASSWORD", "");
      const response = await proxy(request("/"));
      expect(response.status).toBe(503);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });

    it("asks for a password (401) without credentials", async () => {
      const response = await proxy(request("/"));
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });

    it("rejects wrong credentials", async () => {
      const response = await proxy(request("/", "tester:errada"));
      expect(response.status).toBe(401);
    });

    it("lets the right credentials through, marked noindex", async () => {
      const response = await proxy(request("/", "tester:s3nha"));
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });

    it("keeps the public quote link open", async () => {
      const response = await proxy(request("/p/abc123"));
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    });
  });
});
