/// <reference types="vitest/config" />
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { codeInspectorPlugin } from "code-inspector-plugin";

export default defineConfig({
  plugins: [
    ...(process.env.VITEST
      ? []
      : [codeInspectorPlugin({ bundler: "vite" })]),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 默认 info 级别，让 dev 模式显示本地端口
  // 各平台 config 可按需覆盖
  test: {
    // raycast/ 是独立包（有自己的 bun test 与 Raycast CLI），不进 uTools 的 vitest 范围。
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
  },
});
