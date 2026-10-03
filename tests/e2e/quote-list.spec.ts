import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Lista de orçamentos (F-09, NBB-48): estado vazio, cartões, busca pelo cliente (sem acentos) e pelo
// número, abas e as mensagens de lista vazia.

const cards = (page: Page) => page.getByRole("list", { name: "Orçamentos" }).getByRole("listitem");

async function waitSaved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Salvo ✓" })).toBeVisible();
}

test("lista com busca e abas (F-09)", async ({ page, isMobile }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-lista-123");

  // Conta nova: só o convite para criar o primeiro (L6).
  await expect(page.getByText("Você ainda não tem orçamentos")).toBeVisible();
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  await page.getByRole("combobox", { name: "Escolher cliente (opcional)" }).click();
  await page.getByRole("combobox", { name: "Buscar cliente" }).fill("José Silva");
  await page.getByRole("option", { name: 'Criar "José Silva"' }).click();
  await expect(page.getByRole("region", { name: "Cliente" }).getByText("José Silva")).toBeVisible();
  await page.getByLabel("Descrição do item 1").fill("Logo");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
  await waitSaved(page);

  // O segundo, sem cliente, pelo botão de novo orçamento.
  await page.goto("/app/orcamentos");
  if (isMobile) {
    await page.getByRole("button", { name: "Novo orçamento" }).click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "Novo orçamento" }).click();
  }
  await expect(page.getByRole("heading", { name: "Orçamento Nº 0002" })).toBeVisible();
  await page.getByLabel("Descrição do item 1").fill("Site");
  await waitSaved(page);

  // Última atividade primeiro (L2-A).
  await page.goto("/app/orcamentos");
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText("Nº 0002 · Sem cliente");
  await expect(cards(page).nth(1)).toContainText(/Nº 0001 · José Silva\s*R\$\s800,00/u);
  await expect(cards(page).nth(1)).toContainText("Rascunho");

  // Busca sem acentos (L5-A) e pelo número.
  const search = page.getByLabel("Buscar por cliente ou número");
  await search.fill("jose");
  await expect(page).toHaveURL(/busca=jose/);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("José Silva");
  await search.fill("2");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Nº 0002");
  await search.fill("ninguém");
  await expect(page.getByText('Nenhum orçamento encontrado para "ninguém".')).toBeVisible();
  await search.fill("");
  await expect(cards(page)).toHaveCount(2);

  // Abas (L3-A): a aba atual fica marcada e vai para a URL.
  const tabs = page.getByRole("navigation", { name: "Filtrar por status" });
  await tabs.getByRole("link", { name: "Enviados" }).click();
  await expect(page).toHaveURL(/status=enviados/);
  await expect(tabs.getByRole("link", { name: "Enviados" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("Nenhum orçamento enviado.")).toBeVisible();
  await tabs.getByRole("link", { name: "Rascunhos" }).click();
  await expect(cards(page)).toHaveCount(2);

  // Tocar no cartão abre o editor.
  await cards(page).nth(1).getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Orçamento Nº 0001" })).toBeVisible();
});
