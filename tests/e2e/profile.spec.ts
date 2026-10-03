import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Perfil (F-14, NBB-42): cada campo se salva ao perder o foco (D3) e continua lá depois de recarregar.

test("editar o perfil salva ao sair do campo e atualiza a prévia (F-14)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-perfil-123");
  await page.goto("/app/perfil");

  const businessName = page.getByLabel("Nome comercial");
  await businessName.fill("Estúdio Teste");
  await businessName.blur();
  await expect(page.getByText("Salvo ✓")).toBeVisible();

  const instagram = page.getByLabel("Instagram");
  await instagram.fill("meunegocio");
  await instagram.blur();
  // O servidor devolve o valor já limpo (D4).
  await expect(instagram).toHaveValue("@meunegocio");

  const preview = page.getByRole("region", { name: "Prévia do cabeçalho do orçamento" });
  await expect(preview.getByText("Estúdio Teste")).toBeVisible();

  const document = page.getByLabel("CPF ou CNPJ");
  await document.fill("529.982.247-24");
  await document.blur();
  await expect(page.getByText("CPF ou CNPJ inválido")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nome comercial")).toHaveValue("Estúdio Teste");
  await expect(page.getByLabel("Instagram")).toHaveValue("@meunegocio");
  await expect(page.getByLabel("CPF ou CNPJ")).toHaveValue("");
});

// PNG de 1×1 px: o navegador reduz/converte (L2) e o servidor confere pelos bytes.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("enviar, ver na prévia e remover o logo (NBB-81)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-logo-123");
  await page.goto("/app/perfil");

  await page
    .getByLabel("Arquivo do logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Seu logo" })).toBeVisible();
  const preview = page.getByRole("region", { name: "Prévia do cabeçalho do orçamento" });
  await expect(preview.locator("img")).toHaveAttribute("src", /^\/api\/p\/logos\/[0-9a-f-]+\.\w+$/);

  await page.reload();
  await expect(page.getByRole("img", { name: "Seu logo" })).toBeVisible();

  await page.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByRole("img", { name: "Seu logo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar logo" })).toBeVisible();
});

test("logo que não existe mais aparece como sem logo, sem imagem quebrada (ADR-0015)", async ({
  page,
}) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-logo-789");
  await page.goto("/app/perfil");
  await page
    .getByLabel("Arquivo do logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Seu logo" })).toBeVisible();

  // Simula o arquivo perdido (ex.: VPS reconstruída sem os logos): a rota responde 404.
  await page.route("**/api/p/logos/**", (route) => route.fulfill({ status: 404 }));
  await page.reload();

  await expect(page.getByRole("img", { name: "Seu logo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar logo" })).toBeVisible();
  const preview = page.getByRole("region", { name: "Prévia do cabeçalho do orçamento" });
  await expect(preview.locator("img")).toHaveCount(0);
});

test("arquivo que não é imagem é recusado no navegador (RN-05)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-logo-456");
  await page.goto("/app/perfil");

  await page
    .getByLabel("Arquivo do logo")
    .setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Use uma imagem PNG, JPEG ou WebP de até 5 MB.")).toBeVisible();
});
