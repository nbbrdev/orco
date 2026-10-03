import { describe, expect, it } from "vitest";

import { listHref, parseListFilters, searchTarget } from "@/features/quotes/list-filters";

// Abas e busca da lista de orçamentos (F-09, NBB-48 L1-A, L3-A, L5-A).

describe("parseListFilters", () => {
  it("lê a aba e a busca da URL", () => {
    expect(parseListFilters({ status: "enviados", busca: "  Maria " })).toEqual({
      tab: "enviados",
      search: "Maria",
    });
  });

  it("aba desconhecida ou ausente vira todos; repetida usa a primeira", () => {
    expect(parseListFilters({})).toEqual({ tab: "todos", search: "" });
    expect(parseListFilters({ status: "x" }).tab).toBe("todos");
    expect(parseListFilters({ status: ["aprovados", "recusados"] }).tab).toBe("aprovados");
  });

  it("corta a busca em 100 caracteres", () => {
    expect(parseListFilters({ busca: "a".repeat(150) }).search).toHaveLength(100);
  });
});

describe("listHref", () => {
  it("todos e busca vazia não aparecem na URL", () => {
    expect(listHref({ tab: "todos", search: "" })).toBe("/app/orcamentos");
    expect(listHref({ tab: "expirados", search: "" })).toBe("/app/orcamentos?status=expirados");
    expect(listHref({ tab: "todos", search: "João & cia" })).toBe(
      "/app/orcamentos?busca=Jo%C3%A3o+%26+cia",
    );
  });
});

describe("searchTarget", () => {
  it("só dígitos busca o número; o resto, o nome (L5-A)", () => {
    expect(searchTarget("")).toEqual({ by: "none" });
    expect(searchTarget("0012")).toEqual({ by: "number", number: 12 });
    expect(searchTarget("Nº 12")).toEqual({ by: "name", text: "Nº 12" });
  });

  it("número grande demais não casa com nada", () => {
    expect(searchTarget("99999999999")).toEqual({ by: "number", number: 0 });
  });
});
