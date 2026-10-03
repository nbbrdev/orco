import type { NextConfig } from "next";

// Caminho relativo: o alias "@/" não vale dentro do next.config.
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  // Build enxuto para a imagem Docker (Dockerfile, ADR-0012): `.next/standalone` leva só os arquivos
  // e pacotes que o app realmente usa, mais um `server.js` que substitui o `next start`.
  output: "standalone",
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
