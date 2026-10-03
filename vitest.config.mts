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
    // `npm run test:coverage` roda os dois projetos juntos: o relatório soma o que os unitários e a
    // integração executaram (o código de banco só roda na integração). Precisa do banco local ligado.
    coverage: {
      provider: "v8",
      // Todos os arquivos entram no relatório, mesmo sem teste nenhum (aparecem com 0%). Além de
      // src/lib, a lógica de servidor de src/features (NBB-73, C1); os componentes .tsx ficam de fora,
      // porque quem os testa é o E2E, que não entra nesta conta.
      include: ["src/lib/**/*.ts", "src/features/**/*.ts"],
      // Fora da conta (NBB-73, D1-A): arquivos que só rodam dentro de uma requisição do Next ou no
      // navegador. Quem os testa é o E2E. Por isso as Server Actions são uma casca fina, e a regra de
      // negócio fica num arquivo que o Vitest consegue testar (ex.: sign-up.ts, profile.ts).
      exclude: [
        "src/features/**/actions.ts",
        "src/lib/auth/session.ts",
        "src/features/app-shell/nav-items.ts",
        "src/lib/utils.ts",
      ],
      reporter: ["text", "html"],
      thresholds: {
        // Trava geral (NBB-73, C2): o CI falha se a cobertura cair abaixo disso.
        lines: 80,
        statements: 80,
        functions: 80,
        // Regras de cálculo e datas exigem 100% de cobertura (RNF-14).
        "src/lib/money.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/lib/dates.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
