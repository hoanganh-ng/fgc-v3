import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@dtpm/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)),
      "@dtpm/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node"
  }
});
