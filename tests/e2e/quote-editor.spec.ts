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

test("orçamentos no painel do cliente e rascunhos atualizados (NBB-87)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-editor-321");

  await page.goto("/app/clientes");
  await page.getByRole("button", { name: "Novo cliente" }).click();
  const newPanel = page.getByRole("dialog", { name: "Novo cliente" });
  await newPanel.getByLabel("Nome").fill("Ana Lima");
  await newPanel.getByRole("button", { name: "Salvar" }).click();
  await expect(newPanel).toBeHidden();

  // Painel do cliente: ainda sem orçamentos, e o atalho cria um já com ele (D1-A, D2-A).
  const list = page.getByRole("list", { name: "Clientes" });
  await list.getByText("Ana Lima").click();
  await expect(page.getByText("Nenhum orçamento para este cliente ainda.")).toBeVisible();
  await page.getByRole("button", { name: "Novo orçamento para este cliente" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("region", { name: "Cliente" }).getByText("Ana Lima")).toBeVisible();
  await page.getByRole("combobox", { name: "Descrição do item 1" }).fill("Logo");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
  await waitSaved(page);

  // O orçamento aparece no painel, e mudar o cliente pergunta pelos rascunhos (RN-20, D3-A).
  await page.goto("/app/clientes");
  await list.getByText("Ana Lima").click();
  const editPanel = page.getByRole("dialog", { name: "Editar cliente" });
  const clientQuotes = editPanel.getByRole("list", { name: "Orçamentos do cliente" });
  await expect(clientQuotes.getByText("Nº 0001")).toBeVisible();
  await expect(clientQuotes.getByText("Rascunho")).toBeVisible();
  await expect(clientQuotes.getByText(/R\$\s800,00/u)).toBeVisible();

  await editPanel.getByLabel("Nome").fill("Ana Souza");
  await editPanel.getByRole("button", { name: "Salvar" }).click();
  const question = page.getByRole("alertdialog", {
    name: "Atualizar também o rascunho deste cliente?",
  });
  // O painel fecha ao salvar, e a pergunta abre em seguida.
  await question.getByRole("button", { name: "Atualizar" }).click();
  await expect(question).toBeHidden();

  await list.getByText("Ana Souza").click();
  await page
    .getByRole("dialog", { name: "Editar cliente" })
    .getByRole("link", { name: /Nº 0001/ })
    .click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("region", { name: "Cliente" }).getByText("Ana Souza")).toBeVisible();
});

test("descontos e mais opções (NBB-88)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-editor-654");
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);

  await page.getByLabel("Descrição do item 1").fill("Logo");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição do item 2").fill("Site");
  await page.getByLabel("Valor do item 2 (R$)").fill("2.000");

  // Desconto do item pelo menu "⋯" (G1-A): o foco vai direto para o campo.
  await page.getByRole("button", { name: "Ações do item 1" }).click();
  await page.getByRole("menuitem", { name: "Adicionar desconto" }).click();
  const itemDiscount = page.getByLabel("Desconto do item 1", { exact: true });
  await expect(itemDiscount).toBeFocused();
  await itemDiscount.fill("10");
  await expect(items(page).getByText(/R\$\s720,00 \(−10%\)/u)).toBeVisible();

  // Desconto geral em R$ e validade no passado, em "Mais opções" (G2-A, G5-A).
  await page.getByRole("button", { name: "Mais opções" }).click();
  await page
    .getByRole("group", { name: "Tipo do desconto geral" })
    .getByRole("button", { name: "Valor em reais" })
    .click();
  await page.getByLabel("Desconto geral", { exact: true }).fill("220");
  await page.getByLabel("Validade").fill("2020-01-01");
  await expect(
    page.getByText("Essa data já passou: o orçamento vai aparecer como expirado."),
  ).toBeVisible();
  await page.getByLabel("Anotações internas").fill("Cliente indicado pela Ana");

  // Rodapé: total com a linha de subtotal e desconto (G4-A, exemplo da RN-16).
  const total = page.getByLabel("Total do orçamento");
  await expect(total).toHaveText(/R\$\s2\.500,00/u);
  await expect(page.getByText(/Subtotal R\$\s2\.720,00 · Desconto −R\$\s220,00/u)).toBeVisible();
  await waitSaved(page);

  // Desconto maior que o valor: aceito e limitado, com o aviso (G6-A).
  await page.getByLabel("Desconto geral", { exact: true }).fill("5.000");
  await expect(page.getByText("O desconto ficou limitado ao valor.")).toBeVisible();
  await expect(total).toHaveText(/R\$\s0,00/u);
  await page.getByLabel("Desconto geral", { exact: true }).fill("220");
  await waitSaved(page);

  await page.reload();
  await expect(page.getByLabel("Desconto do item 1", { exact: true })).toHaveValue("10");
  await expect(total).toHaveText(/R\$\s2\.500,00/u);
  await page.getByRole("button", { name: "Mais opções" }).click();
  await expect(page.getByLabel("Desconto geral", { exact: true })).toHaveValue("220,00");
  await expect(page.getByLabel("Validade")).toHaveValue("2020-01-01");
  await expect(page.getByLabel("Anotações internas")).toHaveValue("Cliente indicado pela Ana");

  // Tirar o desconto do item pelo ×.
  await page.getByRole("button", { name: "Tirar o desconto do item 1" }).click();
  await expect(page.getByLabel("Desconto do item 1", { exact: true })).toBeHidden();
  await expect(total).toHaveText(/R\$\s2\.580,00/u);
  await waitSaved(page);
});

test("visualizar o PDF sem mudar o status (NBB-51, RN-22a)", async ({ page, context }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-editor-987");
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/([0-9a-f-]{36})$/);
  const quoteId = page.url().split("/").at(-1) ?? "";

  // "Visualizar" logo depois de digitar: abre uma aba nova (a prévia).
  await page.getByLabel("Descrição do item 1").fill("Logo");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "Visualizar" }).click();
  await popup;

  // O PDF da prévia, com a sessão desta conta.
  const response = await page.request.get(`/api/orcamentos/${quoteId}/pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["content-disposition"]).toBe('inline; filename="Orcamento-0001.pdf"');
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Continua rascunho (RN-22a).
  await page.goto("/app/orcamentos");
  await expect(page.getByRole("list", { name: "Orçamentos" })).toContainText("Rascunho");
});
