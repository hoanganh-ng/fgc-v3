import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "backend",
      include: ["src/**/*.test.ts"],
      exclude: ["apps/**/*"],
    },
  },
  "./apps/web/vitest.config.ts",
]);
