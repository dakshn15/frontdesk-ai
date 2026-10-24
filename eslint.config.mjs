import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // App code reads and writes through withRls so row level security always applies.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/jobs/**", "src/app/api/webhooks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db/admin",
              message:
                "Use withRls from @/db. The admin connection is only for jobs and webhooks.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    ".superpowers/**",
  ]),
]);

export default eslintConfig;
