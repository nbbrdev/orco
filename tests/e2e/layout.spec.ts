import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Nada mais largo que a tela (NBB-90 B2-A): com textos longos sem espaço (e-mail, nomes), nenhuma das
// telas principais pode ganhar rolagem lateral. No celular, isso também tira a barra de navegação de
// baixo do lugar.

const LONG_EMAIL = "joana.da.silva.exemplo.com.um.endereco.bem.comprido@empresa-exemplo.com.br";
const LONG_WORD = "Supercalifragilisticexpialidocious-Desenvolvimento-Completo-Sem-Espacos";

async function expectNoSideScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
}

test("textos longos não criam rolagem lateral (NBB-90)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-layout-123");

  // Clientes: o cartão com um e-mail longo.
  await page.goto("/app/clientes");
  await page.getByRole("button", { name: "Novo cliente" }).click();
  const panel = page.getByRole("dialog", { name: "Novo cliente" });
  await panel.getByLabel("Nome").fill(`Cliente ${LONG_WORD}`);
  await panel.getByLabel("E-mail").fill(LONG_EMAIL);
  await panel.getByLabel("Telefone").pressSequentially("11912345678");
  await panel.getByRole("button", { name: "Salvar" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("list", { name: "Clientes" }).getByRole("listitem")).toHaveCount(1);
  await expectNoSideScroll(page);

  // Catálogo: um item com nome longo.
  await page.goto("/app/catalogo");
  await page.getByRole("button", { name: "Novo item" }).click();
  const item = page.getByRole("dialog", { name: "Novo item" });
  await item.getByLabel("Nome").fill(LONG_WORD);
  await item.getByLabel("Preço (R$)").fill("800");
  await item.getByRole("button", { name: "Salvar" }).click();
  await expect(item).toBeHidden();
  await expectNoSideScroll(page);

  // Editor: cliente e item com textos longos.
  await page.goto("/app/orcamentos");
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  await page.getByRole("combobox", { name: "Escolher cliente (opcional)" }).click();
  await page.getByRole("option", { name: new RegExp(LONG_WORD) }).click();
  await page.getByLabel("Descrição do item 1").fill(LONG_WORD);
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
  await expect(page.getByRole("status").filter({ hasText: "Salvo ✓" })).toBeVisible();
  await expectNoSideScroll(page);

  // Lista de orçamentos e perfil.
  await page.goto("/app/orcamentos");
  await expect(page.getByRole("list", { name: "Orçamentos" })).toBeVisible();
  await expectNoSideScroll(page);
  await page.goto("/app/perfil");
  await page.getByLabel("Nome comercial").fill(LONG_WORD);
  await page.getByLabel("E-mail de contato").fill(LONG_EMAIL);
  await page.getByLabel("E-mail de contato").blur();
  await expect(
    page.getByRole("region", { name: "Prévia do cabeçalho do orçamento" }),
  ).toContainText(LONG_EMAIL);
  await expectNoSideScroll(page);
});
