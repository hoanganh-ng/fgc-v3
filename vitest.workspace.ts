import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // Backend tests (Node environment)
  {
    test: {
      name: "backend",
      include: ["src/**/*.test.ts"],
      exclude: ["apps/**/*"],
    },
  },
  // Web tests (jsdom environment with React)
  {
    test: {
      name: "web",
      environment: "jsdom",
      include: ["apps/web/src/**/*.test.ts", "apps/web/src/**/*.test.tsx"],
      resolveConfig: true,
    },
    resolve: {
      alias: {
        "@": "/home/hahaha/coding/fgc-v3/apps/web/src",
      },
    },
  },
]);
