import { describe, expect, it } from "vitest";

import { clientSchema } from "@/features/clients/schemas";
import { searchClients } from "@/features/clients/search";

// Formulário e busca de clientes (F-15, NBB-44).

describe("formulário de cliente", () => {
  it("só o nome é obrigatório; o resto vazio vira null (RN-07)", () => {
    expect(
      clientSchema.parse({
        name: " Ana ",
        email: "",
        phone: "",
        document: "",
        address: "",
        internalNotes: "",
      }),
    ).toEqual({
      name: "Ana",
      email: null,
      phone: null,
      document: null,
      address: null,
      internalNotes: null,
    });
  });

  it("recusa nome vazio ou longo demais", () => {
    expect(clientSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(clientSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
  });

  it("limpa e confere e-mail, telefone e CPF/CNPJ (RN-08, K2)", () => {
    const parsed = clientSchema.parse({
      name: "Ana",
      email: " Ana@Example.com ",
      phone: "(11) 91234-5678",
      document: "529.982.247-25",
      address: "",
      internalNotes: "",
    });
    expect(parsed).toMatchObject({
      email: "ana@example.com",
      phone: "(11) 91234-5678",
      document: "52998224725",
    });

    const invalid = clientSchema.safeParse({
      name: "Ana",
      email: "ana@",
      phone: "abc",
      document: "529.982.247-24",
      address: "",
      internalNotes: "",
    });
    expect(invalid.error?.issues.map((issue) => issue.path[0])).toEqual([
      "email",
      "phone",
      "document",
    ]);
  });
});

describe("busca de clientes (K4-A)", () => {
  const list = [
    { name: "João da Silva", email: "joao@example.com", document: "52998224725" },
    { name: "Maria Souza", email: null, document: "12ABC34501DE35" },
    { name: "Estúdio Ônix", email: "contato@onix.example.com", document: null },
  ];

  it("termo vazio mostra todos", () => {
    expect(searchClients(list, "  ")).toHaveLength(3);
  });

  it("nome sem acentos nem maiúsculas", () => {
    expect(searchClients(list, "joao").map((client) => client.name)).toEqual(["João da Silva"]);
    expect(searchClients(list, "ONIX").map((client) => client.name)).toEqual(["Estúdio Ônix"]);
  });

  it("por e-mail", () => {
    expect(searchClients(list, "contato@").map((client) => client.name)).toEqual(["Estúdio Ônix"]);
  });

  it("por CPF/CNPJ, com ou sem pontuação", () => {
    expect(searchClients(list, "529.982").map((client) => client.name)).toEqual(["João da Silva"]);
    expect(searchClients(list, "12.abc").map((client) => client.name)).toEqual(["Maria Souza"]);
  });

  it("nada encontrado", () => {
    expect(searchClients(list, "zzz")).toEqual([]);
  });
});
