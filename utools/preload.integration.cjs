const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

function loadBridge(rename, overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
  const realFs = require("node:fs");
  const utools = {
    dbStorage: {
      getItem: () => "[]",
      setItem: () => true,
    },
    showSaveDialog: () => null,
    onPluginEnter: () => {},
    ...overrides,
  };
  const context = {
    window: {},
    utools,
    console,
    process,
    setTimeout,
    clearTimeout,
    require: (name) => {
      if (name === "electron") return { nativeTheme: { on: () => {} } };
      if (name !== "fs") return require(name);
      return { ...realFs, renameSync: rename || realFs.renameSync };
    },
  };
  vm.runInNewContext(source, context, { filename: "preload.cjs" });
  return context.window.goose2fa;
}

describe("uTools 自动同步桥接文件读取", () => {
  it("区分缺失、目录、超限与非绝对路径，正常文件返回内容与 mtime", () => {
    const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "goose-2fa-read-")));
    const target = path.join(directory, "sync.json");
    fs.writeFileSync(target, '{"app":"goose-2fa"}', { mode: 0o600 });
    const big = path.join(directory, "big.json");
    fs.writeFileSync(big, "x".repeat(5 * 1024 * 1024 + 1));
    try {
      const bridge = loadBridge();
      const ok = bridge.readSyncFile(target);
      assert.equal(ok.ok, true);
      assert.equal(ok.content, '{"app":"goose-2fa"}');
      assert.equal(ok.size, Buffer.byteLength(ok.content));
      assert.equal(typeof ok.mtimeMs, "number");
      const reason = (filePath) => {
        const result = bridge.readSyncFile(filePath);
        assert.equal(result.ok, false);
        return result.reason;
      };
      assert.equal(reason(path.join(directory, "missing.json")), "missing");
      assert.equal(reason(directory), "unreadable");
      assert.equal(reason(big), "too-large");
      assert.equal(reason("relative.json"), "unreadable");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("uTools 自动同步桥接文件写入", () => {
  it("拒绝无效路径，成功写入 0600，rename 失败保留原文件并清理临时文件", () => {
    const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "goose-2fa-")));
    const target = path.join(directory, "sync.json");
    const lockPath = `${target}.lock`;
    fs.writeFileSync(target, "old", { mode: 0o600 });
    try {
      const bridge = loadBridge();
      assert.equal(bridge.writeSyncFile("relative.json", "bad", lockPath, null).ok, false);
      assert.equal(bridge.writeSyncFile(target, "bad", lockPath, null, true).reason, "conflict");
      assert.equal(fs.readFileSync(target, "utf8"), "old");
      const written = bridge.writeSyncFile(target, "new", lockPath, null);
      assert.equal(written.ok, true);
      assert.equal(typeof written.mtimeMs, "number");
      assert.equal(fs.readFileSync(target, "utf8"), "new");
      assert.equal(fs.statSync(target).mode & 0o777, 0o600);
      // 写入结束后不残留锁文件
      assert.deepEqual(fs.readdirSync(directory), ["sync.json"]);

      fs.writeFileSync(target, "old", { mode: 0o600 });
      const failing = loadBridge(() => { throw new Error("rename failed"); });
      assert.equal(failing.writeSyncFile(target, "should-not-replace", lockPath, null).ok, false);
      assert.equal(fs.readFileSync(target, "utf8"), "old");
      assert.deepEqual(fs.readdirSync(directory), ["sync.json"]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("与 Raycast 端共用同一锁名：被持锁时拒绝写入并报告持有者，绝不按时间抢锁", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "goose-2fa-lock-"));
    const target = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "goose-2fa-lock-real-")));
    const file = path.join(target, "sync.json");
    // 锁名必须与 shared/sync-protocol.ts 的 syncLockPath 一致
    const lockPath = `${file}.lock`;
    fs.writeFileSync(file, "old", { mode: 0o600 });
    try {
      const bridge = loadBridge();
      fs.writeFileSync(lockPath, `4242\n1700000000000\n`, { mode: 0o600 });
      const blocked = bridge.writeSyncFile(file, "blocked", lockPath, null);
      assert.equal(blocked.ok, false);
      assert.equal(blocked.reason, "locked");
      // 锁内容原样交给上层解析（shared/sync-protocol.ts 的 parseSyncLockInfo）
      assert.equal(blocked.lockContent, `4242\n1700000000000\n`);
      assert.equal(fs.readFileSync(file, "utf8"), "old");

      // 看起来「很旧」的锁也不能被抢占：删掉活锁会让两个写入端同时写同一个文件
      const stale = new Date(Date.now() - 86_400_000);
      fs.utimesSync(lockPath, stale, stale);
      assert.equal(bridge.writeSyncFile(file, "stolen", lockPath, null).reason, "locked");
      assert.equal(fs.readFileSync(file, "utf8"), "old");
      assert.equal(fs.existsSync(lockPath), true);

      // 显式清理后才允许写入
      assert.equal(bridge.clearSyncLock(lockPath), true);
      assert.equal(bridge.clearSyncLock(lockPath), false);
      assert.equal(bridge.writeSyncFile(file, "after-clear", lockPath, null).ok, true);
      assert.equal(fs.readFileSync(file, "utf8"), "after-clear");
      assert.equal(fs.existsSync(lockPath), false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  it("锁内按 expectedContent 逐字节比对，mtime 相同也不算同一版本", () => {
    const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "goose-2fa-cas-")));
    const file = path.join(directory, "sync.json");
    fs.writeFileSync(file, "old", { mode: 0o600 });
    try {
      const bridge = loadBridge();
      const lockPath = `${file}.lock`;
      const mtime = fs.statSync(file).mtimeMs;
      // 外部改成同长度内容且 mtime 被刻意保留：stat 看不出来，内容比对必须拦住
      fs.writeFileSync(file, "ext", { mode: 0o600 });
      fs.utimesSync(file, new Date(mtime), new Date(mtime));
      assert.equal(bridge.writeSyncFile(file, "new", lockPath, "old").reason, "conflict");
      assert.equal(fs.readFileSync(file, "utf8"), "ext");

      assert.equal(bridge.writeSyncFile(file, "new", lockPath, "ext").ok, true);
      assert.equal(fs.readFileSync(file, "utf8"), "new");

      // 基线文件不存在时也必须拒绝，不能把缺失当空内容
      assert.equal(bridge.writeSyncFile(path.join(directory, "gone.json"), "new", `${path.join(directory, "gone.json")}.lock`, "old").reason, "conflict");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("别名路径被拒绝，真实路径解析到同一文件与同一把锁", () => {
    const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "goose-2fa-real-")));
    const file = path.join(directory, "sync.json");
    const alias = path.join(directory, "alias.json");
    fs.writeFileSync(file, "old", { mode: 0o600 });
    fs.symlinkSync(file, alias);
    try {
      const bridge = loadBridge();
      assert.equal(bridge.resolveSyncPath(alias), file);
      assert.equal(bridge.resolveSyncPath(file), file);
      // 缺失文件的父目录同样解析到真实目录
      assert.equal(bridge.resolveSyncPath(`${directory}/missing.json`), `${directory}/missing.json`);
      // 别名路径直接拒绝读写：否则会给自己一把新锁，出现两个写入端
      assert.equal(bridge.readSyncFile(alias).reason, "unresolved");
      assert.equal(bridge.writeSyncFile(alias, "new", `${alias}.lock`, null).reason, "unresolved");
      assert.equal(fs.readFileSync(file, "utf8"), "old");
      // 真实路径正常读写，锁名也只对应真实文件
      assert.equal(bridge.readSyncFile(file).content, "old");
      assert.equal(bridge.writeSyncFile(file, "new", `${file}.lock`, null).ok, true);
      assert.equal(fs.readFileSync(file, "utf8"), "new");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});


describe("uTools 文档目录默认数据文件", () => {
  it("使用宿主文档目录，并用同一个默认路径打开新建对话框", () => {
    const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "goose-2fa-documents-")));
    let options;
    try {
      const bridge = loadBridge(undefined, {
        getPath: (name) => { assert.equal(name, "documents"); return directory; },
        showSaveDialog: (input) => { options = input; return null; },
      });
      assert.equal(bridge.getDefaultSyncPath(), path.join(directory, "goose-2fa.json"));
      bridge.selectSyncPath("new");
      assert.equal(options.defaultPath, bridge.getDefaultSyncPath());
      assert.deepEqual(fs.readdirSync(directory), []);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
