import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

export default mergeConfig(baseConfig, {
  base: "./",
  build: {
    outDir: "dist-utools",
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name].js",
        entryFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
    rolldownOptions: {
      external: [
        "@tauri-apps/api/core",
        "@tauri-apps/api/window",
        "@tauri-apps/plugin-clipboard-manager",
        "@tauri-apps/plugin-dialog",
        "@tauri-apps/plugin-notification",
      ],
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
  },
});
