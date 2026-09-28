import type { NextConfig } from "next";

// Caminho relativo: o alias "@/" não vale dentro do next.config.
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Não anuncia "X-Powered-By: Next.js" (só ajudaria um atacante a mirar).
  poweredByHeader: false,
  // Só no `npm run dev`: libera abrir o app pelo IP do PC na rede local (ex.: no celular, na mesma
  // Wi-Fi). Faixas privadas: nenhum site da internet tem esses endereços. Cada `*` = um número do IP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  async headers() {
    return securityHeaders;
  },
};

export default nextConfig;
