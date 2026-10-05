import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

// Imagem de prévia do link da landing (NBB-59 L3-B): o que o WhatsApp e as redes mostram quando
// alguém compartilha o Orçô. Gerada no build a partir deste código, sem PNG no repositório. Fica no
// grupo (landing) para valer só no "/": o link do orçamento do cliente (/p/[token]) não leva a marca.
// Cores e ícone do docs/12-identidade-visual.md; a Inter vem do @fontsource, como no PDF.

export const alt = "Orçô: seus serviços, preços e clientes num só lugar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONTS = path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files");

export default async function OpenGraphImage() {
  const [regular, bold] = await Promise.all([
    readFile(path.join(FONTS, "inter-latin-400-normal.woff")),
    readFile(path.join(FONTS, "inter-latin-700-normal.woff")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 40,
        padding: 96,
        background: "#F6F8F8",
        color: "#10201E",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width="120" height="120" viewBox="0 0 48 48">
          <rect width="48" height="48" rx="10" fill="#0F766E" />
          <path
            d="M16 11h11l7 7v19a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z"
            fill="#FFFFFF"
          />
          <path d="M27 11v5a2 2 0 0 0 2 2h5z" fill="#E6F4F2" />
          <path
            d="M19 28l3.5 3.5L29 25"
            fill="none"
            stroke="#0F766E"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.02em" }}>Orçô</div>
      </div>
      <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.15 }}>
        Seus serviços, preços e clientes num só lugar.
      </div>
      <div style={{ fontSize: 36, color: "#51615F" }}>
        Orçamentos bonitos em 2 minutos, aprovados pelo cliente com um toque.
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
