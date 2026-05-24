import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

const host = process.env.TAURI_DEV_HOST;

export default mergeConfig(baseConfig, {
  // Tauri dev 模式下通过环境变量获取 host
  server: {
    port: 6002,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 6003,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Tauri dev 由 tauri CLI 自己显示端口，Vite 只需安静运行
  logLevel: "warn",
  // 只扫描 src/ 入口，避免 Vite 误扫 dist-utools/ 中的已构建产物
  optimizeDeps: {
    entries: ["src/main.tsx"],
  },
  build: {
    outDir: "dist-tauri",
    target: ["es2021", "chrome100", "safari15"],
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name].js",
        entryFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
  },
});
