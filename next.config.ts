import type { NextConfig } from "next";

// Caminho relativo: o alias "@/" não vale dentro do next.config.
import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Não anuncia "X-Powered-By: Next.js" (só ajudaria um atacante a mirar).
  poweredByHeader: false,
  async headers() {
    return securityHeaders;
  },
};

export default nextConfig;
