import type { NextConfig } from "next";

// Caminho relativo: o alias "@/" não vale dentro do next.config.
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  // Build enxuto para a imagem Docker (Dockerfile, ADR-0012): `.next/standalone` leva só os arquivos
  // e pacotes que o app realmente usa, mais um `server.js` que substitui o `next start`.
  output: "standalone",
  // A Inter do PDF é lida do disco (src/pdf/fonts.ts). Ao montar o `.next/standalone`, o Next leva a
  // pasta inteira de fontes (4,6 MB, com cirílico, grego, itálicos…); a imagem Docker só precisa dos
  // três pesos usados (NBB-51).
  // A chave é um padrão (picomatch): os colchetes de `[id]` precisam de escape.
  // Vale para as duas rotas de PDF: a do dono e a pública (NBB-52).
  outputFileTracingExcludes: {
    "/api/orcamentos/\\[id\\]/pdf": ["./node_modules/@fontsource/inter/files/**"],
    "/api/p/\\[token\\]/pdf": ["./node_modules/@fontsource/inter/files/**"],
  },
  outputFileTracingIncludes: {
    "/api/orcamentos/\\[id\\]/pdf": [
      "./node_modules/@fontsource/inter/files/inter-latin-{400,600,700}-normal.woff",
    ],
    "/api/p/\\[token\\]/pdf": [
      "./node_modules/@fontsource/inter/files/inter-latin-{400,600,700}-normal.woff",
    ],
  },
  reactCompiler: true,
  // Não anuncia "X-Powered-By: Next.js" (só ajudaria um atacante a mirar).
  poweredByHeader: false,
  // Só no `npm run dev`: libera abrir o app pelo IP do PC na rede local (ex.: no celular, na mesma
  // Wi-Fi). Faixas privadas: nenhum site da internet tem esses endereços. Cada `*` = um número do IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // Upload do logo pela Server Action (NBB-81, L3): até 5 MB, o mesmo limite da RN-05 e do Nginx
  // (`client_max_body_size 5m`). O padrão do Next é 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  async headers() {
    return securityHeaders;
  },
};

export default nextConfig;
