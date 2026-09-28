import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

// A renovação de sessão do Supabase é testada à parte; aqui só importa o "porteiro".
vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(async () => NextResponse.next()),
}));

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
