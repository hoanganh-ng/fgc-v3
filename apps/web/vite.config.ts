import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, new URL(".", import.meta.url).pathname, "");
  const apiProxyTarget =
    env.API_PROXY_TARGET?.trim() || "http://localhost:3000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/collector": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
