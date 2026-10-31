import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";
import { createPackage, extractFile } from "@electron/asar";

const rootDir = path.resolve(".");
const distDir = path.join(rootDir, "dist-utools");
const releaseDir = path.join(rootDir, "release");
const { version } = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const output = path.join(releaseDir, `goose-2fa-${version}.upx`);

await mkdir(releaseDir, { recursive: true });
const temporary = await mkdtemp(path.join(releaseDir, ".upx-"));

try {
  const archive = path.join(temporary, "plugin.asar");
  const packed = path.join(temporary, "plugin.upx");
  const unpacked = path.join(temporary, "verified.asar");

  // uTools UPX 采用 gzip 压缩 ASAR；构建完成后从安装包回读并校验。
  // 格式参考：https://github.com/uxiew/vite-plugin-utools/blob/main/src/upx_handler.ts
  await createPackage(distDir, archive);
  await pipeline(createReadStream(archive), createGzip({ level: 9 }), createWriteStream(packed));
  await pipeline(createReadStream(packed), createGunzip(), createWriteStream(unpacked));

  const plugin = JSON.parse(extractFile(unpacked, "plugin.json").toString("utf8"));
  if (plugin.version !== version) throw new Error("插件包版本与 package.json 不一致");
  for (const key of ["main", "preload", "logo"]) {
    if (typeof plugin[key] !== "string" || !extractFile(unpacked, plugin[key]).length) {
      throw new Error(`插件包缺少 ${key} 对应的文件`);
    }
  }

  let fileCount = 0;
  async function verifyResources(relative = "") {
    const entries = await readdir(path.join(distDir, relative), { withFileTypes: true });
    for (const entry of entries) {
      const filename = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        await verifyResources(filename);
      } else {
        const source = await readFile(path.join(distDir, filename));
        if (!extractFile(unpacked, filename).equals(source)) {
          throw new Error(`插件包资源与本次编译结果不一致：${filename}`);
        }
        fileCount += 1;
      }
    }
  }
  await verifyResources();
  await rename(packed, output);
  console.log(`✓ 插件安装包已生成并校验 ${fileCount} 个文件 → ${path.relative(rootDir, output)}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
