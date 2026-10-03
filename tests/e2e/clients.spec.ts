import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Clientes (F-15, NBB-44): criar no painel, buscar, editar e excluir com confirmação. Telefone e
// CPF/CNPJ com máscara (NBB-84).

test("criar, buscar, editar e excluir um cliente (F-15)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-clientes-123");
  await page.goto("/app/clientes");
  await expect(page.getByText("Nenhum cliente ainda.")).toBeVisible();

  // Novo cliente: só o nome é obrigatório (RN-07), e o CPF inválido é recusado (RN-08).
  await page.getByRole("button", { name: "Novo cliente" }).click();
  const panel = page.getByRole("dialog", { name: "Novo cliente" });
  await panel.getByRole("button", { name: "Salvar" }).click();
  await expect(panel.getByText("Informe o nome do cliente.")).toBeVisible();

  await panel.getByLabel("Nome").fill("João da Silva");
  await panel.getByLabel("CPF ou CNPJ").fill("529.982.247-24");
  await panel.getByRole("button", { name: "Salvar" }).click();
  await expect(panel.getByText("CPF ou CNPJ inválido")).toBeVisible();

  // Máscaras enquanto digita (NBB-84): só os números viram (11) 91234-5678 e 529.982.247-25.
  const document = panel.getByLabel("CPF ou CNPJ");
  await document.clear();
  await document.pressSequentially("52998224725");
  await expect(document).toHaveValue("529.982.247-25");
  const phone = panel.getByLabel("Telefone");
  await phone.pressSequentially("11912345678");
  await expect(phone).toHaveValue("(11) 91234-5678");
  await panel.getByLabel("Observações internas").fill("Prefere WhatsApp");
  await panel.getByRole("button", { name: "Salvar" }).click();
  await expect(panel).toBeHidden();

  const list = page.getByRole("list", { name: "Clientes" });
  await expect(list.getByText("João da Silva")).toBeVisible();
  await expect(list.getByText("529.982.247-25")).toBeVisible();

  // Um segundo cliente, para a busca ter o que filtrar.
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByRole("dialog", { name: "Novo cliente" }).getByLabel("Nome").fill("Maria Souza");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(list.getByText("Maria Souza")).toBeVisible();

  // Busca sem acento (K4-A).
  const search = page.getByRole("searchbox", { name: "Buscar clientes" });
  await search.fill("joao");
  await expect(list.getByText("João da Silva")).toBeVisible();
  await expect(list.getByText("Maria Souza")).toBeHidden();
  await search.fill("");

  // Editar: continua salvo depois de recarregar.
  await list.getByText("João da Silva").click();
  const editPanel = page.getByRole("dialog", { name: "Editar cliente" });
  await expect(editPanel.getByLabel("Observações internas")).toHaveValue("Prefere WhatsApp");
  await editPanel.getByLabel("Nome").fill("João Pereira");
  await editPanel.getByRole("button", { name: "Salvar" }).click();
  await expect(editPanel).toBeHidden();

  await page.reload();
  await expect(list.getByText("João Pereira")).toBeVisible();

  // Excluir pede confirmação (K7-A). Enquanto uma janela está aberta, o resto da página fica
  // escondido do leitor de tela, e o painel e a lista "somem" para o teste. Por isso, a ordem: a
  // confirmação fecha, depois o painel fecha (é quando a exclusão terminou), e só então a lista.
  await list.getByText("João Pereira").click();
  const deletePanel = page.getByRole("dialog", { name: "Editar cliente" });
  await deletePanel.getByRole("button", { name: "Excluir" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Excluir João Pereira?" });
  await confirm.getByRole("button", { name: "Excluir" }).click();
  await expect(confirm).toBeHidden();
  await expect(deletePanel).toBeHidden();
  await expect(list.getByText("João Pereira")).toBeHidden();

  await page.reload();
  await expect(list.getByText("Maria Souza")).toBeVisible();
  await expect(list.getByText("João Pereira")).toBeHidden();
});
