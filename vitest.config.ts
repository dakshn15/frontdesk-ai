import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/helpers/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          env: { DB_POOL_MAX: "1" },
          testTimeout: 20000,
        },
      },
      {
        // The demo salon's tests against the real models: nightly in GitHub Actions, or
        // locally with an AI key. Skipped without one.
        extends: true,
        test: {
          name: "eval",
          include: ["tests/eval/**/*.eval.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          env: { DB_POOL_MAX: "1" },
          testTimeout: 600000,
        },
      },
    ],
  },
});
