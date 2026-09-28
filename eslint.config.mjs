import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Regras do Orçô (docs/06-regras-dev.md §5 e docs/07-seguranca.md §4).
  {
    rules: {
      // Tipagem estrita: sem `any` (use `unknown` + Zod) e sem `!` para silenciar nulos.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // Compensa a menor rigidez do npm: só importar pacotes declarados no package.json (ADR-0001).
      "import/no-extraneous-dependencies": "error",

      // O client service_role só pode ser usado nos pontos permitidos (ADR-0005).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin", "**/lib/supabase/admin"],
              message:
                "O client admin (service_role) só pode ser importado pela página pública, pelo PDF público, pelo cron e pela exclusão de conta. Veja docs/07-seguranca.md §4.",
            },
          ],
        },
      ],
    },
  },

  // Desliga regras de formatação que conflitam com o Prettier (deve ser o último bloco de regras).
  prettier,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "src/types/database.ts",
  ]),
]);

export default eslintConfig;
