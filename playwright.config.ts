import { defineConfig, devices } from "@playwright/test";

// Testes E2E (NBB-72, docs/06 §7): o app de verdade no navegador. Só o Chromium, em computador e num
// celular emulado (decisão D6). O app sobe com `next start` (precisa do `npm run build` antes) e usa o
// Postgres e o Mailpit locais (compose.dev.yaml) ou os service containers do CI.
const PORT = 3000;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // `next start` avisa que o projeto usa `output: standalone`, mas funciona; o servidor standalone de
    // verdade (o da imagem Docker) precisaria das pastas estáticas copiadas à parte.
    command: "npm run start",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
