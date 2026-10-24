import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportAsSyncJson } from "@/lib/data-transfer";
import type { AccountData, NewAccountInput } from "@/lib/types";
import type { PlatformAdapter, SyncFileRead } from "@/platform/types";
import { initPlatform, useAccounts } from "../useAccounts";

const input: NewAccountInput = {
  name: "alice@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  counter: 0,
  algorithm: "SHA-1",
};

function makeAdapter(saveAccounts: PlatformAdapter["saveAccounts"] = vi.fn()): PlatformAdapter {
  return {
    loadAccounts: vi.fn(() => []),
    saveAccounts,
    loadGroups: vi.fn(() => []),
    saveGroups: vi.fn(),
    copyText: vi.fn(),
    readClipboardText: vi.fn(() => ""),
    readClipboardImage: vi.fn(() => null),
    captureScreen: vi.fn(async () => null),
    saveToFile: vi.fn(() => true),
    readFromFile: vi.fn(() => null),
    hideWindow: vi.fn(),
    showWindow: vi.fn(),
    showNotification: vi.fn(),
  };
}

/** 内存文件系统，模拟数据源文件、锁与外部程序写入。 */
function makeSyncFiles(initial: Record<string, string> = {}) {
  const contents = new Map(Object.entries(initial));
  const mtimes = new Map<string, number>();
  const locks = new Map<string, string>();
  const writes: string[] = [];
  let clock = 1;
  const mtimeOf = (path: string) => mtimes.get(path) ?? 1;
  return {
    writes,
    read: vi.fn((path: string) => {
      const content = contents.get(path);
      if (content === undefined) return { ok: false as const, reason: "missing" as const };
      return { ok: true as const, content, mtimeMs: mtimeOf(path), size: content.length };
    }),
    write: vi.fn((path: string, content: string, lockPath?: string, expectedContent?: string | null) => {
      if (lockPath) {
        if (locks.has(lockPath)) {
          return { ok: false as const, reason: "locked" as const, lockContent: locks.get(lockPath) ?? null };
        }
        locks.set(lockPath, `${process.pid}\n${Date.now()}\n`);
      }
      try {
        // 版本依据是逐字节内容（mtime/size 不作数）
        if (typeof expectedContent === "string") {
          const current = contents.get(path);
          if (current === undefined || current !== expectedContent) {
            return { ok: false as const, reason: "conflict" as const };
          }
        }
        contents.set(path, content);
        const mtime = (clock += 1);
        mtimes.set(path, mtime);
        writes.push(content);
        return { ok: true as const, mtimeMs: mtime, size: content.length };
      } finally {
        if (lockPath) locks.delete(lockPath);
      }
    }),
    /** 模拟另一个写入端持着锁（内容为 `pid\n创建时间\n`）。 */
    holdLock(lockPath: string, content = `${process.pid}\n${Date.now()}\n`) {
      locks.set(lockPath, content);
    },
    /** 模拟其他程序直接改文件。 */
    setExternal(path: string, content: string) {
      contents.set(path, content);
      mtimes.set(path, (clock += 1));
    },
    content: (path: string) => contents.get(path) ?? null,
    hasLock: (lockPath: string) => locks.has(lockPath),
    /** 模拟平台把符号链接别名解析到真实文件；未登记的路径原样返回。 */
    resolve: vi.fn((path: string) => (path === "/tmp/alias.json" ? "/tmp/sync.json" : path)),
    clearLock(lockPath: string) {
      const existed = locks.delete(lockPath);
      return existed;
    },
  };
}

function attachSyncFiles(adapter: PlatformAdapter, files: ReturnType<typeof makeSyncFiles>, paths: string[] = ["/tmp/sync.json"]) {
  const queue = [...paths];
  adapter.supportsFileSync = true;
  adapter.selectSyncPath = vi.fn(() => queue.shift() ?? null);
  adapter.readSyncFile = files.read as unknown as (path: string) => SyncFileRead;
  adapter.writeSyncFile = files.write as unknown as NonNullable<PlatformAdapter["writeSyncFile"]>;
  adapter.clearSyncLock = files.clearLock;
  adapter.resolveSyncPath = files.resolve as unknown as NonNullable<PlatformAdapter["resolveSyncPath"]>;
}

function storedAccount(id: string, overrides: Partial<AccountData> = {}): AccountData {
  return { ...input, id, createdAt: 1, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
  useAccounts.setState({
    accounts: [],
    trash: [],
    groups: [],
    selectedGroup: null,
    showAddForm: false,
    loadStatus: "ready",
    loadError: null,
    localCacheBroken: false,
    syncEnabled: false,
    syncPath: "",
    syncStatus: "idle",
    syncError: null,
  });
});

describe("账户存储", () => {
  it("持久化强调色并同步到页面属性", () => {
    useAccounts.getState().setAccentColor("ocean");

    expect(useAccounts.getState().accentColor).toBe("ocean");
    expect(localStorage.getItem("goose-2fa-accent")).toBe("ocean");
    expect(document.documentElement).toHaveAttribute("data-accent", "ocean");
  });

  it("串行保存连续变更，最后一次快照包含全部账户", async () => {
    const snapshots: string[][] = [];
    const adapter = makeAdapter(async (accounts) => {
      snapshots.push(accounts.map((account) => account.name));
    });
    initPlatform(adapter);

    useAccounts.getState().addAccount(input);
    useAccounts.getState().addAccount({ ...input, name: "bob@example.com" });

    await vi.waitFor(() => expect(snapshots).toHaveLength(2));
    expect(snapshots).toEqual([
      ["alice@example.com"],
      ["alice@example.com", "bob@example.com"],
    ]);
  });

  it("导入分组 ID 冲突但名称不同时创建新分组", () => {
    initPlatform(makeAdapter());
    useAccounts.setState({
      groups: [{ id: "shared-id", name: "现有分组", order: 0, createdAt: 1 }],
    });

    useAccounts.getState().importAccounts(
      [{ ...input, groupId: "shared-id" }],
      [{ id: "shared-id", name: "备份分组", order: 0, createdAt: 2 }],
    );

    const state = useAccounts.getState();
    expect(state.groups.map((group) => group.name)).toEqual(["现有分组", "备份分组"]);
    expect(state.accounts[0]?.groupId).not.toBe("shared-id");
    expect(state.groups.some((group) => group.id === state.accounts[0]?.groupId)).toBe(true);
  });

  it("保存失败时向用户发出通知", async () => {
    const adapter = makeAdapter(vi.fn(async () => {
      throw new Error("disk full");
    }));
    initPlatform(adapter);

    useAccounts.getState().addAccount(input);

    await vi.waitFor(() => {
      expect(adapter.showNotification).toHaveBeenCalledWith("账户保存失败，请检查存储权限后重试");
    });
  });

  it("可把账户移动到其他分组或未分组，重复投放不会保存", async () => {
    const saveAccounts = vi.fn();
    initPlatform(makeAdapter(saveAccounts));
    useAccounts.setState({
      groups: [{ id: "work", name: "工作", order: 0, createdAt: 1 }],
      accounts: [{
        ...input,
        id: "account-1",
        createdAt: 1,
        groupId: null,
      }],
    });

    useAccounts.getState().updateAccountGroup("account-1", "work");
    expect(useAccounts.getState().accounts[0]?.groupId).toBe("work");

    await vi.waitFor(() => expect(saveAccounts).toHaveBeenCalledTimes(1));
    useAccounts.getState().updateAccountGroup("account-1", "work");
    expect(saveAccounts).toHaveBeenCalledTimes(1);

    useAccounts.getState().updateAccountGroup("account-1", null);
    expect(useAccounts.getState().accounts[0]?.groupId).toBeNull();
    await vi.waitFor(() => expect(saveAccounts).toHaveBeenCalledTimes(2));
  });

  it("本地保存失败后后续保存仍会执行并恢复", async () => {
    const saveAccounts = vi.fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const adapter = makeAdapter(saveAccounts);
    initPlatform(adapter);
    useAccounts.getState().addAccount(input);
    useAccounts.getState().addAccount({ ...input, name: "bob@example.com" });
    await vi.waitFor(() => expect(saveAccounts).toHaveBeenCalledTimes(2));
    expect(saveAccounts.mock.calls[1]?.[0]).toEqual(expect.arrayContaining([expect.objectContaining({ name: "bob@example.com" })]));
  });

  it("连续文件变更保存最后一份完整快照，无需等待本地缓存", async () => {
    const saveAccounts = vi.fn(() => new Promise<void>(() => {}));
    const files = makeSyncFiles();
    const adapter = makeAdapter(saveAccounts);
    attachSyncFiles(adapter, files);
    initPlatform(adapter);
    await useAccounts.getState().selectSyncPath();
    useAccounts.getState().setSyncEnabled(true);
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("success"));
    useAccounts.getState().addAccount(input);
    useAccounts.getState().addAccount({ ...input, name: "bob@example.com" });
    await vi.waitFor(() => expect(JSON.parse(String(files.content("/tmp/sync.json"))).accounts).toHaveLength(2));
    expect(saveAccounts).not.toHaveBeenCalled();
  });

  it("文件模式不依赖 uTools 分组缓存写入", async () => {
    const files = makeSyncFiles();
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.saveGroups = vi.fn().mockRejectedValue(new Error("disk full"));
    initPlatform(adapter);
    await useAccounts.getState().selectSyncPath();
    useAccounts.getState().setSyncEnabled(true);
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("success"));
    useAccounts.getState().createGroup("工作");
    await vi.waitFor(() => expect(JSON.parse(String(files.content("/tmp/sync.json"))).groups[0]?.name).toBe("工作"));
    expect(adapter.saveGroups).not.toHaveBeenCalled();
  });

  it("文件模式启动不读坏缓存，直接以有效文件继续", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([storedAccount("a1")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.loadAccounts = vi.fn(() => { throw new Error("bad local cache"); });
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().loadStatus).toBe("ready");
    expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["a1"]);
    expect(adapter.loadAccounts).not.toHaveBeenCalled();
    expect(adapter.saveAccounts).not.toHaveBeenCalled();
    expect(files.write).not.toHaveBeenCalled();
  });

  it("本地缓存读取失败且数据源文件不可用时进入错误页", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": "{ 不是 JSON" });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.loadAccounts = vi.fn().mockRejectedValue(new Error("read failed"));
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().loadStatus).toBe("error");
    expect(files.write).not.toHaveBeenCalled();
  });

  it("同步关闭时选择路径只记住路径，不覆盖本地数据", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([storedAccount("file-1")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.loadAccounts = vi.fn(() => [storedAccount("local-1")]);
    initPlatform(adapter);
    await useAccounts.getState().load();
    await useAccounts.getState().selectSyncPath();
    expect(useAccounts.getState().syncPath).toBe("/tmp/sync.json");
    expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["local-1"]);
    expect(useAccounts.getState().syncNotice).toContain("已记住路径");
    expect(files.write).not.toHaveBeenCalled();
  });

  it("开启文件模式直接以文件为主并保留 HOTP 计数器", async () => {
    const hotp = storedAccount("h1", { type: "hotp", counter: 3 });
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([{ ...hotp, counter: 9 }]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.loadAccounts = vi.fn(() => [hotp]);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "false");
    initPlatform(adapter);
    await useAccounts.getState().load();
    useAccounts.getState().setSyncEnabled(true);
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("success"));
    expect(useAccounts.getState().accounts[0]?.counter).toBe(9);
    expect(files.write).not.toHaveBeenCalled();
  });

  it("初次读取失败后外部修好文件会自动载入", async () => {
    vi.useFakeTimers();
    try {
      const files = makeSyncFiles();
      const adapter = makeAdapter();
      attachSyncFiles(adapter, files);
      localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
      localStorage.setItem("goose-2fa-sync-enabled", "true");
      initPlatform(adapter);
      await useAccounts.getState().load();
      expect(useAccounts.getState().syncStatus).toBe("error");
      files.setExternal("/tmp/sync.json", exportAsSyncJson([storedAccount("a1")]));
      await vi.advanceTimersByTimeAsync(3000);
      expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["a1"]);
      expect(useAccounts.getState().syncError).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("数据源文件里过期的回收站条目按 30 天规则清理并写回", async () => {
    const expired = storedAccount("t1", { deletedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 });
    const fresh = storedAccount("t2", { deletedAt: Date.now() });
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([], [], [expired, fresh]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().trash.map((a) => a.id)).toEqual(["t2"]);
    await vi.waitFor(() => expect(files.writes.length).toBeGreaterThan(0));
    expect(JSON.parse(String(files.content("/tmp/sync.json"))).trash.map((a: AccountData) => a.id)).toEqual(["t2"]);
  });

  it("加载重试先恢复未保存的内存数据", async () => {
    const adapter = makeAdapter();
    let stored: Parameters<PlatformAdapter["saveAccounts"]>[0] = [];
    adapter.saveAccounts = vi.fn().mockRejectedValueOnce(new Error("disk full"))
      .mockImplementation(async (accounts) => { stored = accounts; });
    adapter.loadAccounts = vi.fn(() => stored);
    initPlatform(adapter);
    useAccounts.getState().addAccount(input);
    await vi.waitFor(() => expect(adapter.showNotification).toHaveBeenCalled());
    await useAccounts.getState().load();
    expect(useAccounts.getState().loadStatus).toBe("ready");
    expect(useAccounts.getState().accounts).toHaveLength(1);
    expect(adapter.saveAccounts).toHaveBeenCalledTimes(2);
  });

  it("文件保存失败可重试，文件模式不写本地缓存", async () => {
    const saveAccounts = vi.fn().mockResolvedValue(undefined);
    const files = makeSyncFiles();
    files.write.mockImplementationOnce(() => { throw new Error("permission denied"); });
    const adapter = makeAdapter(saveAccounts);
    attachSyncFiles(adapter, files);
    initPlatform(adapter);
    await useAccounts.getState().selectSyncPath();
    useAccounts.getState().setSyncEnabled(true);
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("error"));
    useAccounts.getState().retrySync();
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("success"));
    useAccounts.getState().addAccount(input);
    await vi.waitFor(() => expect(JSON.parse(String(files.content("/tmp/sync.json"))).accounts).toHaveLength(1));
    expect(saveAccounts).not.toHaveBeenCalled();
  });

  it("切换路径写入新文件，关闭后重新启用不重复写相同内容", async () => {
    const files = makeSyncFiles();
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files, ["/tmp/a.json", "/tmp/b.json"]);
    initPlatform(adapter);
    useAccounts.setState({ accounts: [storedAccount("a")] });
    await useAccounts.getState().selectSyncPath();
    useAccounts.getState().setSyncEnabled(true);
    await vi.waitFor(() => expect(files.write).toHaveBeenCalledTimes(1));
    await useAccounts.getState().selectSyncPath();
    await vi.waitFor(() => expect(files.write).toHaveBeenCalledTimes(2));
    useAccounts.getState().setSyncEnabled(false);
    useAccounts.getState().setSyncEnabled(true);
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("success"));
    expect(files.write).toHaveBeenCalledTimes(2);
  });

  it("启用数据源后以文件内容为准，不覆盖文件", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([storedAccount("file-1")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.loadAccounts = vi.fn(() => [storedAccount("local-1", { name: "local@example.com" })]);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["file-1"]);
    expect(files.write).not.toHaveBeenCalled();
  });

  it("数据源文件无法解析时进入错误态，不以缓存代替文件", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": "{ 这不是 JSON" });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.loadAccounts = vi.fn(() => [storedAccount("local-1")]);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().loadStatus).toBe("error");
    expect(adapter.loadAccounts).not.toHaveBeenCalled();
    expect(useAccounts.getState().syncStatus).toBe("error");
    expect(files.write).not.toHaveBeenCalled();
  });

  it("数据源文件缺失时不静默新建，用户确认后才写入", async () => {
    const files = makeSyncFiles();
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().syncStatus).toBe("error");
    expect(useAccounts.getState().syncNeedsCreate).toBe(true);
    useAccounts.getState().addAccount(input);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(files.write).not.toHaveBeenCalled();
    expect(useAccounts.getState().accounts).toHaveLength(0);
    useAccounts.getState().createSyncFile();
    await vi.waitFor(() => expect(files.write).toHaveBeenCalled());
    expect(JSON.parse(String(files.content("/tmp/sync.json"))).accounts).toHaveLength(0);
  });

  it("写前发现文件被外部修改时拒绝覆盖，改为载入文件内容", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([storedAccount("a1")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    files.setExternal("/tmp/sync.json", exportAsSyncJson([storedAccount("a1", { note: "外部改动" })]));
    useAccounts.getState().updateNote("a1", "本地改动");
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("conflict"));
    expect(files.writes).toHaveLength(0);
    expect(useAccounts.getState().accounts[0]?.note).toBe("外部改动");
  });

  it("另一个写入端持锁时拒绝写入并提示", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([storedAccount("a1")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    files.holdLock("/tmp/sync.json.lock", "4242\n1700000000000\n");
    useAccounts.getState().updateNote("a1", "本地改动");
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("error"));
    expect(useAccounts.getState().syncError).toContain("正在写入");
    expect(files.writes).toHaveLength(0);
    // 锁只报告持有者，不按时间自动清理
    expect(useAccounts.getState().syncLockHeld).toEqual({ pid: 4242, createdAt: 1700000000000 });
    expect(files.hasLock("/tmp/sync.json.lock")).toBe(true);

    // 用户显式清理后才继续写入
    useAccounts.getState().clearSyncLock();
    expect(files.hasLock("/tmp/sync.json.lock")).toBe(false);
    await vi.waitFor(() => expect(files.writes.length).toBeGreaterThan(0));
    expect(useAccounts.getState().syncLockHeld).toBeNull();
  });

  it("选择路径时解析到真实路径，别名不会产生第二把锁", async () => {
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([storedAccount("file-1")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files, ["/tmp/alias.json"]);
    initPlatform(adapter);
    await useAccounts.getState().load();
    await useAccounts.getState().selectSyncPath();
    expect(useAccounts.getState().syncPath).toBe("/tmp/sync.json");
    expect(localStorage.getItem("goose-2fa-sync-path")).toBe("/tmp/sync.json");
  });

  it("运行期载入外部改动且不回写文件", async () => {
    vi.useFakeTimers();
    try {
      const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([storedAccount("a1")]) });
      const adapter = makeAdapter();
      attachSyncFiles(adapter, files);
      localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
      localStorage.setItem("goose-2fa-sync-enabled", "true");
      initPlatform(adapter);
      await useAccounts.getState().load();
      expect(useAccounts.getState().accounts).toHaveLength(1);
      files.setExternal("/tmp/sync.json", exportAsSyncJson([storedAccount("a1"), storedAccount("a2", { name: "bob@example.com" })]));
      await vi.advanceTimersByTimeAsync(3000);
      expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["a1", "a2"]);
      expect(files.writes).toHaveLength(0);
      expect(useAccounts.getState().syncNotice).toContain("外部改动");
    } finally {
      vi.useRealTimers();
    }
  });

  it("外部文件计数器回退时抬高 HOTP 下限并写回纠正值", async () => {
    const hotp: AccountData = storedAccount("h1", { type: "hotp", counter: 5 });
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([hotp]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    files.setExternal("/tmp/sync.json", exportAsSyncJson([{ ...hotp, counter: 2 }]));
    useAccounts.getState().refreshSync();
    await vi.waitFor(() => expect(useAccounts.getState().accounts[0]?.counter).toBe(5));
    await vi.waitFor(() => expect(files.writes.length).toBeGreaterThan(0));
    expect(JSON.parse(String(files.content("/tmp/sync.json"))).accounts[0].counter).toBe(5);
  });

  it("HOTP 输出前先保存 JSON 计数器，文件写入失败则不输出", async () => {
    const hotp: AccountData = storedAccount("h1", { type: "hotp", counter: 5 });
    const files = makeSyncFiles({ "/tmp/sync.json": exportAsSyncJson([hotp]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    files.write.mockImplementationOnce(() => ({ ok: false, reason: "io" }) as never);
    localStorage.setItem("goose-2fa-sync-path", "/tmp/sync.json");
    localStorage.setItem("goose-2fa-sync-enabled", "true");
    initPlatform(adapter);
    await useAccounts.getState().load();
    await expect(useAccounts.getState().incrementCounter("h1")).resolves.toBe(false);
    expect(files.writes).toHaveLength(0);
    useAccounts.getState().retrySync();
    await vi.waitFor(() => expect(useAccounts.getState().syncStatus).toBe("success"));
    await expect(useAccounts.getState().incrementCounter("h1")).resolves.toBe(true);
    const written = JSON.parse(String(files.content("/tmp/sync.json")));
    expect(written.accounts[0].counter).toBeGreaterThan(5);
    expect(written.accounts[0].counter).toBe(useAccounts.getState().accounts[0]?.counter);
  });

  it("拒绝未知分组，避免把账户误移到未分组", () => {
    const saveAccounts = vi.fn();
    initPlatform(makeAdapter(saveAccounts));
    useAccounts.setState({
      accounts: [{
        ...input,
        id: "account-1",
        createdAt: 1,
        groupId: "work",
      }],
      groups: [{ id: "work", name: "工作", order: 0, createdAt: 1 }],
    });

    useAccounts.getState().updateAccountGroup("account-1", "missing");

    expect(useAccounts.getState().accounts[0]?.groupId).toBe("work");
    expect(saveAccounts).not.toHaveBeenCalled();
  });
});

describe("分组存储", () => {
  it("创建分组时写入平台存储，而不是只留在 localStorage", async () => {
    const saveGroups = vi.fn();
    const adapter = makeAdapter();
    adapter.saveGroups = saveGroups;
    initPlatform(adapter);

    const groupId = useAccounts.getState().createGroup("工作");
    expect(groupId).toBeTruthy();
    await vi.waitFor(() => expect(saveGroups).toHaveBeenCalledTimes(1));
    expect(saveGroups).toHaveBeenCalledWith([
      expect.objectContaining({ id: groupId, name: "工作" }),
    ]);
    expect(localStorage.getItem("goose-2fa-groups")).toBeNull();
  });

  it("加载时优先使用平台分组，并迁移旧 localStorage 分组", async () => {
    const saveGroups = vi.fn();
    const legacy = [{ id: "legacy", name: "旧分组", order: 0, createdAt: 1 }];
    localStorage.setItem("goose-2fa-groups", JSON.stringify(legacy));

    const adapter = makeAdapter();
    adapter.loadGroups = vi.fn(async () => []);
    adapter.saveGroups = saveGroups;
    initPlatform(adapter);

    await useAccounts.getState().load();

    expect(useAccounts.getState().groups).toEqual(legacy);
    await vi.waitFor(() => expect(saveGroups).toHaveBeenCalledWith(legacy));
    await vi.waitFor(() => expect(localStorage.getItem("goose-2fa-groups")).toBeNull());
  });

  it("平台已有分组时覆盖旧 localStorage 脏数据", async () => {
    const platformGroups = [{ id: "cloud", name: "云端分组", order: 0, createdAt: 2 }];
    localStorage.setItem(
      "goose-2fa-groups",
      JSON.stringify([{ id: "legacy", name: "旧分组", order: 0, createdAt: 1 }]),
    );

    const adapter = makeAdapter();
    adapter.loadGroups = vi.fn(async () => platformGroups);
    adapter.saveGroups = vi.fn();
    initPlatform(adapter);

    await useAccounts.getState().load();

    expect(useAccounts.getState().groups).toEqual(platformGroups);
    expect(localStorage.getItem("goose-2fa-groups")).toBeNull();
  });
});

describe("默认文档 JSON 数据模式", () => {
  const path = "/tmp/Documents/goose-2fa.json";
  const preferences = { viewMode: "list" as const, selectedGroup: null, accentColor: "pine" as const, isDark: true, isThemeLocked: true };

  it("首次默认启用并迁移账户、分组、回收站和偏好到同一个文件", async () => {
    const files = makeSyncFiles();
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.getDefaultSyncPath = () => path;
    adapter.loadAccounts = vi.fn(() => [storedAccount("local")]);
    adapter.loadGroups = vi.fn(() => [{ id: "work", name: "工作", order: 0, createdAt: 1 }]);
    localStorage.setItem("goose-2fa-trash", JSON.stringify([storedAccount("trash", { deletedAt: Date.now() })]));
    useAccounts.setState(preferences);
    initPlatform(adapter);
    expect(useAccounts.getState().syncEnabled).toBe(true);
    expect(useAccounts.getState().syncPath).toBe(path);
    await useAccounts.getState().load();
    const payload = JSON.parse(String(files.content(path)));
    expect(payload.accounts.map((a: AccountData) => a.id)).toEqual(["local"]);
    expect(payload.groups[0].name).toBe("工作");
    expect(payload.trash.map((a: AccountData) => a.id)).toEqual(["trash"]);
    expect(payload.preferences).toEqual(preferences);
    expect(JSON.stringify(payload)).not.toContain(path);
    expect(adapter.saveAccounts).not.toHaveBeenCalled();
  });

  it("每次打开全量重读文件，内容变化但 stat 相同也载入最新数据和设置", async () => {
    const original = exportAsSyncJson([storedAccount("a", { note: "A" })], [], [], preferences);
    const files = makeSyncFiles({ [path]: original });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.getDefaultSyncPath = () => path;
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().viewMode).toBe("list");
    expect(useAccounts.getState().accentColor).toBe("pine");
    expect(useAccounts.getState().isDark).toBe(true);
    const read = files.read.getMockImplementation()!;
    files.read.mockImplementation((target) => {
      const result = read(target);
      return result.ok ? { ...result, mtimeMs: 1, size: original.length } : result;
    });
    files.setExternal(path, exportAsSyncJson([storedAccount("a", { note: "B" })], [], [], { ...preferences, viewMode: "grid" }));
    await useAccounts.getState().load();
    expect(useAccounts.getState().accounts[0]?.note).toBe("B");
    expect(useAccounts.getState().viewMode).toBe("grid");
    expect(files.read).toHaveBeenCalledTimes(2);
    expect(adapter.loadAccounts).not.toHaveBeenCalled();
    expect(adapter.saveAccounts).not.toHaveBeenCalled();
    expect(files.write).not.toHaveBeenCalled();
  });

  it("账户、分组、回收站与用户偏好改动写回同一个 JSON", async () => {
    const files = makeSyncFiles({ [path]: exportAsSyncJson([storedAccount("a")], [], [], preferences) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.getDefaultSyncPath = () => path;
    initPlatform(adapter);
    await useAccounts.getState().load();
    useAccounts.getState().updateNote("a", "已修改");
    useAccounts.getState().createGroup("工作");
    useAccounts.getState().setViewMode("compact");
    useAccounts.getState().setAccentColor("ocean");
    useAccounts.getState().toggleDark();
    useAccounts.getState().removeAccount("a");
    await vi.waitFor(() => {
      const payload = JSON.parse(String(files.content(path)));
      expect(payload.accounts).toHaveLength(0);
      expect(payload.trash[0].note).toBe("已修改");
      expect(payload.groups[0].name).toBe("工作");
      expect(payload.preferences).toMatchObject({ viewMode: "compact", accentColor: "ocean", isDark: false, isThemeLocked: true });
      expect(payload.preferences.selectedGroup).toBe(payload.groups[0].id);
    });
    expect(adapter.saveAccounts).not.toHaveBeenCalled();
    expect(adapter.saveGroups).not.toHaveBeenCalled();
  });

  it("默认文件已存在但无效时不读取缓存或覆盖原文件", async () => {
    const files = makeSyncFiles({ [path]: "{bad json" });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.getDefaultSyncPath = () => path;
    initPlatform(adapter);
    await useAccounts.getState().load();
    expect(useAccounts.getState().loadStatus).toBe("error");
    expect(adapter.loadAccounts).not.toHaveBeenCalled();
    expect(files.write).not.toHaveBeenCalled();
    expect(files.content(path)).toBe("{bad json");
  });

  it("默认文件以后丢失不会自动重建，并可在设置中显式新建", async () => {
    const files = makeSyncFiles({ [path]: exportAsSyncJson([storedAccount("a")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.getDefaultSyncPath = () => path;
    initPlatform(adapter);
    await useAccounts.getState().load();
    files.read.mockImplementation(() => ({ ok: false, reason: "missing" }));
    await useAccounts.getState().load();
    expect(useAccounts.getState().loadStatus).toBe("error");
    expect(useAccounts.getState().syncNeedsCreate).toBe(true);
    expect(files.write).not.toHaveBeenCalled();
    useAccounts.getState().createSyncFile();
    await vi.waitFor(() => expect(files.write).toHaveBeenCalled());
  });

  it("读取未完成或失败时禁止账户和偏好变更，避免随后被文件静默覆盖", async () => {
    const source = exportAsSyncJson([storedAccount("file")], [], [], preferences);
    const files = makeSyncFiles({ [path]: source });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.getDefaultSyncPath = () => path;
    let release: (value: SyncFileRead) => void = () => {};
    adapter.readSyncFile = vi.fn(() => new Promise<SyncFileRead>((resolve) => { release = resolve; }));
    useAccounts.setState({ ...preferences, accounts: [storedAccount("current")] });
    initPlatform(adapter);
    const opening = useAccounts.getState().load();
    await vi.waitFor(() => expect(adapter.readSyncFile).toHaveBeenCalled());
    useAccounts.getState().addAccount(input);
    useAccounts.getState().updateNote("current", "不应覆盖");
    useAccounts.getState().setViewMode("grid");
    useAccounts.getState().setAccentColor("ocean");
    expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["current"]);
    expect(useAccounts.getState().viewMode).toBe("list");
    expect(useAccounts.getState().accentColor).toBe("pine");
    release({ ok: true, content: source, mtimeMs: 1, size: source.length });
    await opening;
    expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["file"]);
    adapter.readSyncFile = files.read;
    files.setExternal(path, "bad JSON");
    await useAccounts.getState().load();
    useAccounts.getState().setViewMode("grid");
    useAccounts.getState().removeAccount("file");
    expect(useAccounts.getState().viewMode).toBe("list");
    expect(useAccounts.getState().accounts.map((a) => a.id)).toEqual(["file"]);
    expect(files.write).not.toHaveBeenCalled();
  });

  it("关闭文件模式回存本地数据，重启保留关闭状态", async () => {
    const files = makeSyncFiles({ [path]: exportAsSyncJson([storedAccount("a")]) });
    const adapter = makeAdapter();
    attachSyncFiles(adapter, files);
    adapter.getDefaultSyncPath = () => path;
    initPlatform(adapter);
    await useAccounts.getState().load();
    useAccounts.getState().setSyncEnabled(false);
    await vi.waitFor(() => expect(adapter.saveAccounts).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })]));
    initPlatform(adapter);
    expect(useAccounts.getState().syncEnabled).toBe(false);
  });
});

describe("外观三态", () => {
  it("浅色、深色锁定主题，跟随系统解除锁定并读取系统外观", () => {
    useAccounts.getState().setThemeMode("dark");
    expect(useAccounts.getState()).toMatchObject({ isDark: true, isThemeLocked: true });
    expect(localStorage.getItem("goose-2fa-dark")).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    useAccounts.getState().setThemeMode("light");
    expect(useAccounts.getState()).toMatchObject({ isDark: false, isThemeLocked: true });
    expect(localStorage.getItem("goose-2fa-dark")).toBe("false");

    useAccounts.getState().setThemeMode("dark");
    useAccounts.getState().setThemeMode("system");
    expect(useAccounts.getState()).toMatchObject({ isDark: false, isThemeLocked: false });
    expect(localStorage.getItem("goose-2fa-dark")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
