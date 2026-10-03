// Gera os ícones PNG do PWA a partir do SVG-fonte (docs/identidade/orco-icone.svg, NBB-60 W1).
// Uso: `npm run icons`. Rodar de novo só se o ícone mudar; os PNGs ficam commitados em public/icons/.
//
// O Playwright (já usado nos testes E2E) abre o SVG num navegador invisível e tira um "print" em
// cada tamanho. Sem dependência nova.
import { mkdirSync, readFileSync } from "node:fs";

import { chromium } from "@playwright/test";

const source = readFileSync("docs/identidade/orco-icone.svg", "utf8");

// Sem cantos arredondados: o próprio sistema recorta (W3, maskable) ou arredonda (iPhone). O desenho do
// documento já fica dentro da zona segura do maskable (círculo de 80% no centro).
const squareSource = source.replace(/\srx="10"/, "");

const icons = [
  { file: "icon-192.png", size: 192, svg: source },
  { file: "icon-512.png", size: 512, svg: source },
  { file: "icon-maskable-512.png", size: 512, svg: squareSource },
  { file: "apple-touch-icon.png", size: 180, svg: squareSource },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const { file, size, svg } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const sized = svg.replace(/width="48" height="48"/, `width="${size}" height="${size}"`);
  await page.setContent(`<html><body style="margin:0">${sized}</body></html>`);
  await page.locator("svg").screenshot({ path: `public/icons/${file}`, omitBackground: true });
  console.log(`public/icons/${file} (${size}×${size})`);
}

await browser.close();
