import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      target: "node20",
      rollupOptions: {
        external: [
          "@findly/watcher", // ⭐ ADD THIS
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
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: {
          index: "src/renderer/index.html",
          spotlight: "src/renderer/spotlight.html",
        },
      },
    },
    plugins: [react()],
  },
});
