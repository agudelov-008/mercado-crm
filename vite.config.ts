import { defineConfig } from "vite";
import { tanstackRouterPlugin } from "@tanstack/router-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tanstackRouterPlugin(),
    react(),
  ],
  server: {
    port: 3000,
    proxy: {
      "/yahoo-api": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yahoo-api/, ""),
      },
    },
  },
  build: {
    outDir: ".vercel/output",
  }
});