import { expect, test } from "@playwright/test";

// Termos de uso e política de privacidade (RF-34, NBB-30): páginas públicas, com links no cadastro,
// nas telas de conta e entre si.

test("termos e privacidade abrem sem login e apontam um para o outro", async ({ page }) => {
  await page.goto("/termos");
  await expect(page.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeVisible();
  await expect(page.getByText(/Última atualização: \d{2}\/\d{2}\/\d{4}/)).toBeVisible();

  await page.getByRole("link", { name: "Política de privacidade" }).first().click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de privacidade" }),
  ).toBeVisible();
  await expect(page.getByText("Nícolas Bernardino Bretschneider")).toBeVisible();
  await expect(page.getByRole("link", { name: "nbbr.dev@gmail.com" }).first()).toHaveAttribute(
    "href",
    "mailto:nbbr.dev@gmail.com",
  );
});

test("o cadastro avisa o aceite e as telas de conta levam aos documentos (NBB-30 T5)", async ({
  page,
}) => {
  await page.goto("/cadastro");
  const consent = page.getByText("Ao criar a conta, você concorda com os");
  await expect(consent).toBeVisible();
  await consent.getByRole("link", { name: "Termos de uso" }).click();
  await expect(page).toHaveURL(/\/termos$/);

  await page.goto("/entrar");
  const legal = page.getByRole("navigation", { name: "Documentos legais" });
  await legal.getByRole("link", { name: "Privacidade" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
});
