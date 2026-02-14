import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      target: "node20",
      rollupOptions: {
        external: [
          "@findly/watcher",
          "chokidar"
        ],
      },
    },
  },

  preload: {
    build: {
      outDir: "dist/preload",
      target: "node20",
    },
  },

  renderer: {
    root: "src/renderer",
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
    plugins: [react()],
  },
});
