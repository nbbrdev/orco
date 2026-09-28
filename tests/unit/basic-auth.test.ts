import { describe, expect, it } from "vitest";

import { isAuthorized, isPublicPath } from "@/lib/basic-auth";

function basic(credentials: string): string {
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

describe("isAuthorized", () => {
  it("accepts the right user and password", () => {
    expect(isAuthorized(basic("tester:s3nha"), "tester", "s3nha")).toBe(true);
  });

  it("accepts passwords containing ':' and non-ASCII characters", () => {
    expect(isAuthorized(basic("tester:a:b:ção"), "tester", "a:b:ção")).toBe(true);
  });

  it.each([
    ["wrong password", basic("tester:errada")],
    ["wrong user", basic("outro:s3nha")],
    ["empty credentials", basic(":")],
    ["no separator", basic("testers3nha")],
    ["other scheme", "Bearer abc"],
    ["garbage", "Basic !!!"],
  ])("rejects %s", (_label, header) => {
    expect(isAuthorized(header, "tester", "s3nha")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorized(null, "tester", "s3nha")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it.each(["/p/abc123", "/api/p/abc123/pdf", "/sw.js", "/manifest.webmanifest"])(
    "%s is public",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    },
  );

  it.each(["/", "/p", "/painel", "/api/quotes", "/sw.js.map", "/pdf"])(
    "%s is protected",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});
