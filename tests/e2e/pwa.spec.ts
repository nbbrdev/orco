import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// PWA instalável e tema (RF-36, RNF-16, NBB-60). A instalação em si é testada à mão (W8).

test("manifesto, ícones e service worker são servidos (RF-36)", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = (await manifest.json()) as {
    name: string;
    start_url: string;
    display: string;
    icons: { src: string; purpose: string }[];
  };
  expect(body).toMatchObject({ name: "Orçô", start_url: "/app/orcamentos", display: "standalone" });
  expect(body.icons.map((icon) => icon.purpose)).toContain("maskable");

  for (const { src } of body.icons) {
    const icon = await request.get(src);
    expect(icon.headers()["content-type"]).toBe("image/png");
  }
  expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);

  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain("skipWaiting");
});

test("a página aponta o ícone do iPhone e registra o service worker", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/apple-touch-icon.png",
  );
  await expect
    .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())))
    .toBe(true);
});

test("trocar o tema vale na hora e continua depois de recarregar (RNF-16)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-tema-123");
  await page.goto("/app/perfil");
  const html = page.locator("html");

  await page.getByRole("radio", { name: "Escuro" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("radio", { name: "Escuro" })).toHaveAttribute("aria-checked", "true");

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.getByRole("radio", { name: "Claro" }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);
});
