import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Fora do Next, `import "server-only"` lança erro de propósito; nos testes (que rodam no
      // servidor, em Node) ele é trocado por um módulo vazio.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        // Contra um Postgres real (compose.dev.yaml ou o service container do CI).
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
        },
      },
    ],
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
