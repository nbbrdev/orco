import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Editor de orçamento, parte 1 (F-05, NBB-86): criar pelo botão, digitar os itens, ver o total na
// hora, salvar sozinho, reordenar arrastando (pelo teclado) e remover pelo menu.

const items = (page: Page) => page.getByRole("list", { name: "Itens do orçamento" });

async function waitSaved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Salvo ✓" })).toBeVisible();
}

test("criar um orçamento, preencher os itens e o total salvar sozinho (F-05)", async ({
  page,
  isMobile,
}) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-editor-123");

  // No celular, o botão flutuante; no computador, o da barra do topo.
  if (isMobile) {
    await page.getByRole("button", { name: "Novo orçamento" }).click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "Novo orçamento" }).click();
  }
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Orçamento Nº 0001" })).toBeVisible();

  // O orçamento abre com um item vazio, quantidade 1.
  await page.getByLabel("Descrição do item 1").fill("Logo");
  await expect(page.getByLabel("Quantidade do item 1")).toHaveValue("1");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");

  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição do item 2").fill("Site");
  await page.getByLabel("Valor do item 2 (R$)").fill("2.000");

  const total = page.getByLabel("Total do orçamento");
  await expect(total).toHaveText(/R\$\s2\.800,00/u);
  await waitSaved(page);

  // Campo inválido: destaca e não salva até corrigir (P3-A).
  await page.getByLabel("Quantidade do item 2").fill("abc");
  await expect(page.getByText("Corrija os campos destacados para salvar")).toBeVisible();
  await expect(page.getByText("Informe uma quantidade válida")).toBeVisible();
  await page.getByLabel("Quantidade do item 2").fill("2");
  await expect(total).toHaveText(/R\$\s4\.800,00/u);
  await waitSaved(page);

  await page.reload();
  await expect(page.getByLabel("Descrição do item 1")).toHaveValue("Logo");
  await expect(page.getByLabel("Valor do item 2 (R$)")).toHaveValue("2.000,00");
  await expect(total).toHaveText(/R\$\s4\.800,00/u);
});

test("reordenar arrastando e remover pelo menu (R1, R2, R3)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-editor-456");
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);

  await page.getByLabel("Descrição do item 1").fill("Primeiro");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição do item 2").fill("Segundo");
  await waitSaved(page);

  // Arrastar pelo teclado: foco na alça, espaço pega, seta para cima, espaço solta. O @dnd-kit só
  // começa a ouvir as setas um instante depois de pegar o item (mais devagar no celular), então a seta
  // é repetida até o aviso para leitor de tela dizer a posição 1; no topo, uma seta a mais não muda nada.
  await page.getByRole("button", { name: "Arrastar o item 2 para reordenar" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Na posição 2.", { exact: true })).toBeAttached();
  await expect(async () => {
    await page.keyboard.press("ArrowUp");
    await expect(page.getByText("Na posição 1.", { exact: true })).toBeAttached({ timeout: 500 });
  }).toPass();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Descrição do item 1")).toHaveValue("Segundo");
  await waitSaved(page);

  await page.reload();
  await expect(page.getByLabel("Descrição do item 1")).toHaveValue("Segundo");
  await expect(page.getByLabel("Descrição do item 2")).toHaveValue("Primeiro");

  // Remover pelo menu "⋯", sem confirmação (P5-A, R3-A).
  await page.getByRole("button", { name: "Ações do item 1" }).click();
  await page.getByRole("menuitem", { name: "Remover" }).click();
  await expect(items(page).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByLabel("Descrição do item 1")).toHaveValue("Primeiro");
  await waitSaved(page);

  await page.reload();
  await expect(items(page).getByRole("listitem")).toHaveCount(1);
});

test("cliente e catálogo no editor (NBB-87)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-editor-789");

  // Um item no catálogo, para as sugestões.
  await page.goto("/app/catalogo");
  await expect(page.getByText("Você também pode salvá-los direto do orçamento.")).toBeVisible();
  await page.getByRole("button", { name: "Novo item" }).click();
  const newItem = page.getByRole("dialog", { name: "Novo item" });
  await newItem.getByLabel("Nome").fill("Criação de logo");
  await newItem.getByLabel("Preço (R$)").fill("800");
  await newItem.getByLabel("Unidade").fill("un");
  await newItem.getByRole("button", { name: "Salvar" }).click();
  await expect(newItem).toBeHidden();

  await page.goto("/app/orcamentos");
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);

  // Cliente criado pelo editor, só com o nome (C4-A).
  await page.getByRole("combobox", { name: "Escolher cliente (opcional)" }).click();
  await page.getByRole("combobox", { name: "Buscar cliente" }).fill("Maria Silva");
  await page.getByRole("option", { name: 'Criar "Maria Silva"' }).click();
  const client = page.getByRole("region", { name: "Cliente" });
  await expect(client.getByText("Maria Silva")).toBeVisible();

  // Sugestão do catálogo ao digitar a descrição, sem acento (C6-A).
  await page.getByRole("combobox", { name: "Descrição do item 1" }).fill("criacao");
  await page.getByRole("option", { name: /Criação de logo/ }).click();
  await expect(page.getByRole("combobox", { name: "Descrição do item 1" })).toHaveValue(
    "Criação de logo",
  );
  await expect(page.getByLabel("Unidade do item 1")).toHaveValue("un");
  await expect(page.getByLabel("Valor do item 1 (R$)")).toHaveValue("800,00");

  // Item novo salvo no catálogo pelo menu (C7-B).
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByRole("combobox", { name: "Descrição do item 2" }).fill("Site institucional");
  await page.getByLabel("Valor do item 2 (R$)").fill("2.000");
  await page.getByRole("button", { name: "Ações do item 2" }).click();
  await page.getByRole("menuitem", { name: "Salvar no catálogo" }).click();
  await page.getByRole("button", { name: "Ações do item 2" }).click();
  await expect(page.getByRole("menuitem", { name: "Salvar no catálogo" })).toBeHidden();
  await page.keyboard.press("Escape");
  await waitSaved(page);

  // Tudo continua depois de recarregar.
  await page.reload();
  await expect(client.getByText("Maria Silva")).toBeVisible();
  await expect(page.getByLabel("Unidade do item 1")).toHaveValue("un");
  await expect(page.getByLabel("Total do orçamento")).toHaveText(/R\$\s2\.800,00/u);

  // Tirar o cliente.
  await client.getByRole("button", { name: "Tirar o cliente" }).click();
  await expect(page.getByRole("combobox", { name: "Escolher cliente (opcional)" })).toBeVisible();

  await page.goto("/app/catalogo");
  await expect(
    page.getByRole("list", { name: "Itens do catálogo" }).getByText("Site institucional"),
  ).toBeVisible();
});
