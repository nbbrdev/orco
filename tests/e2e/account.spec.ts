import { expect, test } from "@playwright/test";

import { linkFromMail, signUpAndConfirm, useOwnIp } from "./helpers";

// NBB-41 de ponta a ponta: navegação logada, Sair (RF-06), recuperação de senha (F-04) e a proteção
// do /app.

test("navegar até o perfil, sair e recuperar a senha (F-04)", async ({ page }) => {
  await useOwnIp(page);
  const email = await signUpAndConfirm(page, "senha-antiga-123");

  // Navegação: a barra certa para o tamanho da tela (a outra fica escondida).
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page).toHaveURL(/\/app\/perfil$/);
  await expect(page.getByRole("link", { name: "Perfil" })).toHaveAttribute("aria-current", "page");

  // Sair: a sessão acaba e o /app volta a pedir login.
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/app/orcamentos");
  await expect(page).toHaveURL(/\/entrar$/);

  // Esqueci minha senha → e-mail → link → nova senha.
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  // Espera a navegação terminar: senão o e-mail é digitado ainda no formulário do /entrar.
  await expect(page).toHaveURL(/\/recuperar-senha$/);
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Se existir uma conta com este e-mail")).toBeVisible();

  await page.goto(await linkFromMail(email, /https?:\/\/\S+reset-password\/\S+/));
  await expect(page).toHaveURL(/\/redefinir-senha\?token=/);

  const field = page.getByLabel("Nova senha");
  await field.fill("senha-nova-456");
  // O olho mostra o que foi digitado (P10).
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(field).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Salvar" }).click();

  // P2: volta ao login com o aviso, e a senha nova funciona.
  await expect(page).toHaveURL(/\/entrar\?aviso=senha-alterada$/);
  await expect(page.getByText("Senha alterada. Entre com a nova senha.")).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-nova-456");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos$/);
});

test("link de redefinição inválido leva a pedir outro (P9)", async ({ page }) => {
  await page.goto("/api/auth/reset-password/invalido?callbackURL=/redefinir-senha");

  await expect(page).toHaveURL(/\/recuperar-senha\?aviso=link-invalido$/);
  await expect(page.getByText("Este link expirou ou já foi usado. Peça um novo")).toBeVisible();
});

for (const path of ["/entrar", "/cadastro"]) {
  test(`"Continuar com Google" em ${path} leva ao Google (F-02)`, async ({ page }) => {
    // A página do Google não é carregada de verdade: só conferimos que o navegador foi para lá.
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "Google" }),
    );
    await page.goto(path);
    await page.getByRole("button", { name: "Continuar com Google" }).click();

    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
    expect(new URL(page.url()).searchParams.get("redirect_uri")).toMatch(
      /\/api\/auth\/callback\/google$/,
    );
  });
}

test("voltar do Google sem entrar mostra o motivo (G5)", async ({ page }) => {
  await page.goto("/entrar?error=access_denied");
  await expect(page.getByText("Login cancelado.")).toBeVisible();

  await page.goto("/entrar?error=unable_to_link_account");
  await expect(page.getByText("Este e-mail já tem uma conta esperando confirmação")).toBeVisible();
});

test("sem login, as páginas do app mandam para o /entrar (P5)", async ({ page }) => {
  for (const path of [
    "/app",
    "/app/clientes",
    "/app/catalogo",
    "/app/perfil",
    "/app/orcamentos",
    "/app/orcamentos/00000000-0000-4000-8000-000000000000",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/entrar$/);
  }
});
