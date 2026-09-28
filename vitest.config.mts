import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      reporter: ["text", "html"],
      // Regras de cálculo e datas exigem 100% de cobertura (RNF-14).
      thresholds: {
        "src/lib/money.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/lib/dates.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
