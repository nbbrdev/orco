import { describe, expect, it } from "vitest";

import { profileFieldSchemas } from "@/features/profile/schemas";

// Limpeza e validação dos campos do perfil (F-14, NBB-42 D4).

const { website, instagram, phone, contactEmail, document, defaultValidityDays, displayName } =
  profileFieldSchemas;

describe("campos do perfil", () => {
  it("texto vazio apaga o campo (null)", () => {
    expect(displayName.parse("   ")).toBeNull();
    expect(displayName.parse(" Ana ")).toBe("Ana");
  });

  it("site: acrescenta https:// e recusa o que não é endereço", () => {
    expect(website.parse("meusite.com.br")).toBe("https://meusite.com.br");
    expect(website.parse("http://meusite.com")).toBe("http://meusite.com");
    expect(website.safeParse("não é site").success).toBe(false);
  });

  it("Instagram: guarda sempre @usuario", () => {
    expect(instagram.parse("fulano")).toBe("@fulano");
    expect(instagram.parse("@fulano")).toBe("@fulano");
    expect(instagram.parse("https://www.instagram.com/fulano/")).toBe("@fulano");
    expect(instagram.safeParse("nome com espaço").success).toBe(false);
  });

  it("telefone e e-mail: só o formato", () => {
    expect(phone.parse("(11) 91234-5678")).toBe("(11) 91234-5678");
    expect(phone.safeParse("abc").success).toBe(false);
    expect(contactEmail.parse(" Ana@Example.com ")).toBe("ana@example.com");
    expect(contactEmail.safeParse("ana@").success).toBe(false);
  });

  it("CPF/CNPJ: guarda sem pontuação e recusa inválido", () => {
    expect(document.parse("529.982.247-25")).toBe("52998224725");
    expect(document.safeParse("529.982.247-24").success).toBe(false);
  });

  it("validade padrão: 1 a 365 dias (RN-19)", () => {
    expect(defaultValidityDays.parse("30")).toBe(30);
    expect(defaultValidityDays.safeParse("0").success).toBe(false);
    expect(defaultValidityDays.safeParse("366").success).toBe(false);
    expect(defaultValidityDays.safeParse("1.5").success).toBe(false);
  });
});
