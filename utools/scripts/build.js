import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist-utools");
const rootDir = path.resolve(".");

if (!fs.existsSync(distDir)) {
  console.error("dist-utools 目录不存在");
  process.exit(1);
}

try {
  const preloadSrc = path.join(rootDir, "utools/preload.cjs");
  if (fs.existsSync(preloadSrc)) {
    fs.copyFileSync(preloadSrc, path.join(distDir, "preload.js"));
  }

  fs.writeFileSync(
    path.join(distDir, "package.json"),
    JSON.stringify({ type: "commonjs" }),
  );

  const logoSrc = path.join(rootDir, "public/logo.png");
  if (fs.existsSync(logoSrc)) {
    fs.copyFileSync(logoSrc, path.join(distDir, "logo.png"));
  }

  const pluginConfigPath = path.join(rootDir, "utools/plugin.json");
  if (fs.existsSync(pluginConfigPath)) {
    const pluginConfig = JSON.parse(
      fs.readFileSync(pluginConfigPath, "utf-8"),
    );
    pluginConfig.main = "index.html";
    pluginConfig.preload = "preload.js";
    fs.writeFileSync(
      path.join(distDir, "plugin.json"),
      JSON.stringify(pluginConfig, null, 2),
    );
  } else {
    console.error("未找到 plugin.json");
    process.exit(1);
  }

  function removeMapFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        removeMapFiles(full);
      } else if (entry.name.endsWith(".map")) {
        fs.unlinkSync(full);
      }
    }
  }
  removeMapFiles(distDir);

  console.log(`\n✓ uTools 构建完成 → ${path.relative(rootDir, distDir)}/`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
