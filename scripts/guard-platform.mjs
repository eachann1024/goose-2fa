/* 平台守卫：构建脚本前置校验，确保 mac/win/linux 在对应宿主系统上执行。
   Tauri 的原生打包（.dmg/.msi/.deb/AppImage）依赖各自 OS 的工具链，无法在异构宿主上
   原生交叉编译，故跨平台发布应交给对应 OS 的 CI runner（见 README 构建矩阵）。
   用法：node scripts/guard-platform.mjs <darwin|win32|linux> */
const want = process.argv[2];
const NAMES = { darwin: "macOS", win32: "Windows", linux: "Linux" };
const cur = process.platform;

if (cur !== want) {
  console.error(
    `✗ 此命令需在 ${NAMES[want] ?? want} 上运行，当前宿主为 ${NAMES[cur] ?? cur}。\n` +
      `  Tauri 原生包无法跨 OS 交叉编译，请在对应系统或 CI runner 上构建：\n` +
      `    macOS  → bun run mac\n` +
      `    Windows→ bun run win\n` +
      `    Linux  → bun run linux`
  );
  process.exit(1);
}
