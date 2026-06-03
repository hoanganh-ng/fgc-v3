import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@dtpm/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom"
  }
});
