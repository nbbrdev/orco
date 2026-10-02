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
