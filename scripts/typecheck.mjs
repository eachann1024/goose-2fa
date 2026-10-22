#!/usr/bin/env node
// 类型检查入口：支持的平台用 tsrs（TS 7 的 Rust 移植），否则或 tsrs 起不来时兜底用本地 typescript 的 tsc。
// 参数原样透传，例如 `node scripts/typecheck.mjs --noEmit -p tsconfig.json`。
// TYPECHECK_ENGINE=tsc 强制用 tsc，=tsrs 强制用 tsrs（不兜底），默认 auto。
// TSRS_BINARY 可指定 tsrs 二进制路径（不存在时视为不可用）。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const args = process.argv.slice(2);
const engine = (process.env.TYPECHECK_ENGINE || "auto").toLowerCase();

// tsrs 发布的平台包：darwin-arm64、linux-{x64,arm64}-{gnu,musl}
function tsrsPackage() {
  const key = `${process.platform}-${process.arch}`;
  if (key === "darwin-arm64") return "@tsrs/darwin-arm64";
  if (key === "linux-x64" || key === "linux-arm64") {
    const report = process.report && process.report.getReport ? process.report.getReport() : null;
    const glibc = report && report.header && report.header.glibcVersionRuntime;
    return `@tsrs/${key}-${glibc ? "gnu" : "musl"}`;
  }
  return null;
}

function findTsrs() {
  if (process.env.TSRS_BINARY) {
    return existsSync(process.env.TSRS_BINARY) ? process.env.TSRS_BINARY : null;
  }
  const pkg = tsrsPackage();
  if (!pkg) return null;
  // 先从 tsrs 包自身解析（pnpm 不把平台包提升到根目录），再从项目根解析
  const bases = [];
  try {
    bases.push(createRequire(require.resolve("tsrs/package.json")));
  } catch {
    // 没装 tsrs 包
  }
  bases.push(require);
  for (const req of bases) {
    try {
      const exe = path.join(path.dirname(req.resolve(`${pkg}/package.json`)), "tsrs");
      if (existsSync(exe)) return exe;
    } catch {
      // 换下一个位置
    }
  }
  return null;
}

function runTsc(reason) {
  if (reason) console.error(`[typecheck] ${reason}，改用 tsc`);
  let tsc;
  try {
    // typescript 7 的 exports 不暴露 bin/tsc，按 package.json 的 bin 字段拼路径
    const pkgJson = require.resolve("typescript/package.json");
    const bin = require(pkgJson).bin;
    tsc = path.join(path.dirname(pkgJson), typeof bin === "string" ? bin : bin.tsc);
    if (!existsSync(tsc)) throw new Error(tsc);
  } catch {
    console.error("[typecheck] 找不到本地 typescript，无法兜底");
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [tsc, ...args], { stdio: "inherit" });
  if (r.error) {
    console.error(`[typecheck] tsc 启动失败：${r.error.message}`);
    process.exit(1);
  }
  process.exit(r.status === null ? 1 : r.status);
}

if (engine === "tsc") runTsc("");

const exe = findTsrs();
if (!exe) {
  if (engine === "tsrs") {
    console.error("[typecheck] TYPECHECK_ENGINE=tsrs，但本机没有可用的 tsrs 二进制");
    process.exit(1);
  }
  runTsc(`tsrs 不支持或未安装（${process.platform}-${process.arch}）`);
}

const r = spawnSync(exe, args, { stdio: "inherit" });
// 正常结束：0 = 通过，1/2 = 报出类型或配置错误，直接返回，不兜底
if (!r.error && r.signal === null && r.status !== null && r.status <= 2) process.exit(r.status);
// 其余都算 tsrs 自身崩溃：启动失败、被信号杀死、panic（101）等
const why = r.error ? `启动失败：${r.error.message}` : r.signal ? `被信号 ${r.signal} 终止` : `异常退出（${r.status}）`;
if (engine === "tsrs") {
  console.error(`[typecheck] tsrs ${why}`);
  process.exit(1);
}
runTsc(`tsrs ${why}`);
