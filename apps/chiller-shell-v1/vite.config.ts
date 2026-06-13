import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // 3D runtime (three + loaders + meshopt) is route-lazy and expected to be large.
    // Raise warning threshold so CI/build logs only flag unexpected oversized chunks.
    chunkSizeWarningLimit: 700
  },
  server: {
    host: "127.0.0.1",
    port: 3001,
    proxy: {
      "/bff": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      },
      "/admin": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      }
    }
  }
});
