import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// F-01 de ponta a ponta: cadastrar → abrir o link do e-mail (lido no Mailpit) → entrar logado.

test("cadastro com e-mail e senha, confirmação e entrada logada (F-01)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-e2e-1234");

  // Logado na tela de orçamentos, que ainda está vazia (F-09).
  await expect(page.getByRole("heading", { name: "Orçamentos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar primeiro orçamento" })).toBeVisible();
});

test("link de confirmação inválido leva ao login com aviso (F-01)", async ({ page }) => {
  await page.goto("/api/auth/verify-email?token=invalido&callbackURL=/app/orcamentos");

  await expect(page).toHaveURL(/\/entrar\?aviso=link-invalido$/);
  await expect(page.getByText("Este link expirou ou já foi usado")).toBeVisible();
});
