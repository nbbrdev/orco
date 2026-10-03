import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Exclusão de conta (F-17, RN-06, NBB-43) de ponta a ponta.

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("excluir a conta apaga tudo e a pessoa não entra mais (F-17)", async ({ page }) => {
  await useOwnIp(page);
  const password = "senha-excluir-123";
  const email = await signUpAndConfirm(page, password);
  await page.goto("/app/perfil");
  await page
    .getByLabel("Arquivo do logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Seu logo" })).toBeVisible();

  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  const confirm = page.getByRole("button", { name: "Excluir conta definitivamente" });
  // Só com EXCLUIR exato (RN-06).
  await page.getByLabel("Digite EXCLUIR para confirmar").fill("excluir");
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await confirm.click();

  await expect(page).toHaveURL(/\/\?conta=excluida$/);
  await expect(page.getByText("Sua conta foi excluída")).toBeVisible();

  // A sessão acabou e a conta não existe mais.
  await page.goto("/app/perfil");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});
