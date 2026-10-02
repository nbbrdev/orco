import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/features/auth/schemas";
import { clientIpFrom } from "@/lib/request";

describe("signUpSchema", () => {
  it("aceita e-mail e senha de 8 caracteres, normalizando o e-mail", () => {
    const result = signUpSchema.safeParse({ email: "  Maria@Example.com ", password: "12345678" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("maria@example.com");
  });

  it("recusa senha com menos de 8 caracteres (RN-03)", () => {
    const result = signUpSchema.safeParse({ email: "a@example.com", password: "1234567" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("pelo menos 8");
  });

  it("recusa e-mail inválido", () => {
    expect(signUpSchema.safeParse({ email: "nao-e-email", password: "12345678" }).success).toBe(
      false,
    );
  });

  it("aceita o campo isca vazio ou ausente", () => {
    expect(
      signUpSchema.safeParse({ email: "a@example.com", password: "12345678", website: "" }).success,
    ).toBe(true);
  });
});

describe("signInSchema", () => {
  it("exige a senha", () => {
    expect(signInSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });
});

describe("clientIpFrom", () => {
  it("usa o primeiro IP do X-Forwarded-For", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
  });

  it("cai para o X-Real-IP e depois para 'unknown'", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
