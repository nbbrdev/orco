import path from "node:path";

import { Font } from "@react-pdf/renderer";

// Inter com os acentos do português (ADR-0003, doc 12, NBB-50 N2-A): os arquivos .woff do pacote
// @fontsource/inter, sem fonte binária no repositório. O PDF embute só os caracteres usados.

const FILES = path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files");

let registered = false;

/** Registra a Inter (400, 600 e 700) uma vez por processo. */
export function registerFonts(): void {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [400, 600, 700].map((fontWeight) => ({
      src: path.join(FILES, `inter-latin-${fontWeight}-normal.woff`),
      fontWeight,
    })),
  });
  // Sem hifenização automática: palavras em português não são quebradas no meio.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
