import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Catálogo (F-16, NBB-45): criar no painel (preço em reais, opcional), buscar, editar e excluir.

test("criar, buscar, editar e excluir um item do catálogo (F-16)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-catalogo-123");
  await page.goto("/app/catalogo");
  await expect(page.getByText("Itens que você usa sempre ficam aqui.")).toBeVisible();

  // Preço inválido é recusado; com preço e unidade, aparece "R$ 800,00 / h" (I2-A, I6-A).
  await page.getByRole("button", { name: "Novo item" }).click();
  const panel = page.getByRole("dialog", { name: "Novo item" });
  await panel.getByLabel("Nome").fill("Criação de logo");
  await panel.getByLabel("Preço (R$)").fill("oitocentos");
  await panel.getByRole("button", { name: "Salvar" }).click();
  await expect(panel.getByText("Informe um preço válido")).toBeVisible();

  await panel.getByLabel("Preço (R$)").fill("800");
  await panel.getByLabel("Unidade").fill("h");
  await panel.getByRole("button", { name: "Salvar" }).click();
  await expect(panel).toBeHidden();

  const list = page.getByRole("list", { name: "Itens do catálogo" });
  await expect(list.getByText("Criação de logo")).toBeVisible();
  await expect(list.getByText(/R\$\s800,00 \/ h/u)).toBeVisible();

  // Item sem preço (RN-10).
  await page.getByRole("button", { name: "Novo item" }).click();
  await page.getByRole("dialog", { name: "Novo item" }).getByLabel("Nome").fill("Site");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(list.getByText("Sem preço")).toBeVisible();

  // Busca sem acento.
  const search = page.getByRole("searchbox", { name: "Buscar no catálogo" });
  await search.fill("criacao");
  await expect(list.getByText("Criação de logo")).toBeVisible();
  await expect(list.getByText("Site")).toBeHidden();
  await search.fill("");

  // Editar: o preço volta formatado no campo e a mudança fica depois de recarregar.
  await list.getByText("Criação de logo").click();
  const editPanel = page.getByRole("dialog", { name: "Editar item" });
  await expect(editPanel.getByLabel("Preço (R$)")).toHaveValue("800,00");
  await editPanel.getByLabel("Preço (R$)").fill("1.250,50");
  await editPanel.getByRole("button", { name: "Salvar" }).click();
  await expect(editPanel).toBeHidden();

  await page.reload();
  await expect(list.getByText(/R\$\s1\.250,50 \/ h/u)).toBeVisible();

  // Excluir pede confirmação.
  await list.getByText("Site").click();
  await page
    .getByRole("dialog", { name: "Editar item" })
    .getByRole("button", { name: "Excluir" })
    .click();
  await page
    .getByRole("alertdialog", { name: "Excluir Site?" })
    .getByRole("button", { name: "Excluir" })
    .click();
  await expect(list.getByText("Site")).toBeHidden();

  await page.reload();
  await expect(list.getByText("Criação de logo")).toBeVisible();
  await expect(list.getByText("Site")).toBeHidden();
});
