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
    // 3001 is the fixed local entry.  Never silently move the UI to 3002/3003.
    strictPort: true,
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
