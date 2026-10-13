import { GROUP_KEY, snapshotPreferences, applyFilePreferences } from "./preferences";
import type { AccountData, VaultGroup } from "@/lib/types";
import type { SyncFileRead } from "@/platform/types";
import { parseSyncSnapshot, type SyncPreferences } from "@/lib/data-transfer";
import { normalizeSyncPath, type SyncLockInfo } from "../../../shared/sync-protocol";
import { keepHotpFloor, pruneExpiredTrash } from "../../../shared/vault-ops";
import { normalizeStoredAccounts } from "@/lib/account-validation";
import { resolveSelectedGroup } from "@/lib/groups";
import type { StoreRuntime, StoreServices, StoreAccess, SyncStatus, SourceRead } from "./store-types";

export function createSyncSource(runtime: StoreRuntime, services: StoreServices, store: StoreAccess) {
  function syncFingerprint(path: string, accounts: AccountData[], groups: VaultGroup[], trash: AccountData[], preferences = snapshotPreferences(store.getState())): string {
    return JSON.stringify([
      path,
      normalizeStoredAccounts(accounts),
      groups.map((group) => ({ id: group.id, name: group.name, order: group.order, createdAt: group.createdAt })),
      normalizeStoredAccounts(trash),
      { ...preferences, isDark: preferences.isThemeLocked ? preferences.isDark : false },
    ]);
  }

  async function readSyncSource(path: string): Promise<SourceRead> {
    if (!runtime.platform.readSyncFile) return { status: "error" };
    let raw: SyncFileRead;
    try {
      raw = await Promise.resolve(runtime.platform.readSyncFile(path));
    } catch {
      return { status: "error" };
    }
    if (!raw || raw.ok !== true) {
      if (raw && raw.reason === "missing") return { status: "missing" };
      if (raw && raw.reason === "unresolved") return { status: "unresolved" };
      return { status: "error" };
    }
    if (!raw.content.trim()) return { status: "empty" };
    const snapshot = parseSyncSnapshot(raw.content);
    if (!snapshot) return { status: "invalid" };
    return { status: "ok", snapshot, content: raw.content, mtimeMs: raw.mtimeMs, size: raw.size };
  }

  function isMissingFile(status: SourceRead["status"]): boolean {
    return status === "missing" || status === "empty";
  }

  /**
   * 词法规范化 + 平台解析真实父目录/真实文件。
   * 同一文件经符号链接别名访问时必须落到同一路径，否则两端会各写一把锁、同时写同一个文件。
   */
  function resolveSyncPath(input: string): string {
    const normalized = normalizeSyncPath(input);
    if (!normalized || typeof runtime.platform.resolveSyncPath !== "function") return normalized;
    try {
      return runtime.platform.resolveSyncPath(normalized) || normalized;
    } catch {
      return normalized;
    }
  }

  /** 锁从不按时间自动清理，只报告持有者，由用户确认后显式清理。 */
  function syncLockMessage(info: SyncLockInfo): string {
    const holder = info.pid ? `持有者进程 ${info.pid}` : "持有者未知";
    const created = info.createdAt ? `，创建于 ${new Date(info.createdAt).toLocaleString()}` : "";
    return `另一个程序正在写入数据源文件（${holder}${created}），本次改动没有写入。残留锁不会被自动清理：确认没有任何一端在写入后，可在设置里清理锁文件再重试。`;
  }

  /**
   * 以数据源文件为准刷新内存与本地缓存。
   * 只有显式传入的 feedback 决定状态文案，状态与数据在同一次 setState 里提交。
   */
  function applySourceSnapshot(
    path: string,
    source: Extract<SourceRead, { status: "ok" }>,
    feedback: { status: SyncStatus; error: string | null; notice: string | null },
  ): void {
    const state = store.getState();
    const { accounts, raised } = keepHotpFloor(source.snapshot.accounts, state.accounts);
    const preferences: SyncPreferences = source.snapshot.preferences ?? snapshotPreferences(state);
    const loadedPreferences = applyFilePreferences(preferences);
    runtime.skipLocalCache = true;
    runtime.defaultBootstrapPending = false;
    runtime.writeApproval = null;
    runtime.accountsPersistFailed = false;
    runtime.groupsPersistFailed = false;
    const groups = source.snapshot.groups;
    const trash = pruneExpiredTrash(source.snapshot.trash);
    const trashPruned = trash.length !== source.snapshot.trash.length;
    runtime.syncBaseline = { path, content: source.content, mtimeMs: source.mtimeMs, size: source.size };
    runtime.syncWriteVersion += 1;
    // 内存与文件一致时不要回写，否则会和另一端互相触发写入；计数器被抬高或回收站被清理时才需要纠正写回。
    runtime.lastSyncFingerprint = raised || trashPruned ? null : syncFingerprint(path, accounts, groups, trash, loadedPreferences);
    const selectedGroup = resolveSelectedGroup(loadedPreferences.selectedGroup, groups, accounts);
    if (selectedGroup) localStorage.setItem(GROUP_KEY, selectedGroup);
    else localStorage.removeItem(GROUP_KEY);
    // 读取文件不再覆盖 uTools 缓存；只有清理过期回收站或抬高 HOTP 下限才纠正写回。
    store.setState({
      ...loadedPreferences,
      accounts,
      groups,
      trash,
      selectedGroup,
      loadStatus: "ready",
      loadError: null,
      localCacheBroken: false,
      syncStatus: feedback.status,
      syncError: feedback.error,
      syncNotice: feedback.notice,
      syncNeedsCreate: false,
    });
    services.startSyncWatch();
    if (raised || trashPruned) services.scheduleSync();
  }

  /** 同步失败：同一条错误只提示一次，避免轮询/重试时反复弹通知。 */
  function failSync(message: string, extra?: { syncNeedsCreate?: boolean }): void {
    const state = store.getState();
    if (state.syncStatus !== "error" || state.syncError !== message) {
      runtime.platform.showNotification(message);
    }
    store.setState({
      syncStatus: "error",
      syncError: message,
      syncNotice: null,
      ...(extra ?? {}),
    });
  }

  return { syncFingerprint, readSyncSource, isMissingFile, resolveSyncPath, syncLockMessage, applySourceSnapshot, failSync };
}
