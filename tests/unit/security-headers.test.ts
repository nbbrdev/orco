import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

type Rule = { source: string; headers: { key: string; value: string }[] };

function headersFor(rules: Rule[], source: string): Record<string, string> {
  const rule = rules.find((r) => r.source === source);
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
}

describe("security headers (next.config)", () => {
  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sends the global security headers on every route", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const global = headersFor(rules, "/:path*");

    expect(global["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(global["X-Frame-Options"]).toBe("DENY");
    expect(global["X-Content-Type-Options"]).toBe("nosniff");
    expect(global["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(global["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    expect(global["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("keeps the public quote token private (no referrer, no indexing)", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const publicQuote = headersFor(rules, "/p/:path*");

    expect(publicQuote["Referrer-Policy"]).toBe("no-referrer");
    expect(publicQuote["X-Robots-Tag"]).toBe("noindex, nofollow");
    // A regra de /p/* precisa vir depois da global para sobrescrever o Referrer-Policy.
    expect(rules.findIndex((r) => r.source === "/p/:path*")).toBeGreaterThan(
      rules.findIndex((r) => r.source === "/:path*"),
    );
  });
});
