import { create } from "zustand";
import type { PlatformAdapter } from "@/platform/types";
import { applyAccentColor } from "@/lib/accent-color";
import type { AccountsState, StoreRuntime, StoreServices, StoreAccess } from "./accounts/store-types";
export type { SyncStatus, ViewMode } from "./accounts/store-types";
import { loadViewMode, loadSelectedGroup, loadAccentColor, SYNC_ENABLED_KEY, SYNC_PATH_KEY } from "./accounts/preferences";
import { createStorage } from "./accounts/storage";
import { createSyncSource } from "./accounts/sync-source";
import { createSyncWriter } from "./accounts/sync-write";
import { createSyncWatcher } from "./accounts/sync-watch";
import { createLoadActions } from "./accounts/load-actions";
import { createAccountActions } from "./accounts/account-actions";
import { createGroupActions } from "./accounts/group-actions";
import { createTrashActions } from "./accounts/trash-actions";
import { createSyncSetupActions } from "./accounts/sync-setup-actions";
import { createSyncResolutionActions } from "./accounts/sync-resolution-actions";
import { createPreferenceActions } from "./accounts/preferences";

let platform: PlatformAdapter;
let persistQueue: Promise<void> = Promise.resolve();
let syncQueue: Promise<void> = Promise.resolve();
let lastSyncFingerprint: string | null = null;
let syncEpoch = 0;
let localRevision = 0;
let accountsPersistFailed = false;
let groupsPersistFailed = false;
/** 最近一次已确认的磁盘内容；写前必须与它比对，不同则说明外部改过文件。 */
let syncBaseline: { path: string; content: string; mtimeMs: number; size: number } | null = null;
/** 用户显式批准的写入：create 只允许新建缺失文件，overwrite 允许替换内容不同的文件。 */
let writeApproval: { path: string; mode: "create" | "overwrite" } | null = null;
/** 磁盘内容被确认（写入成功或读取过文件）时递增，用于判断某次改动是否真的落盘。 */
let syncWriteVersion = 0;
let pendingLocalWrites = 0;
let syncWriteInFlight = false;
let syncWatchTimer: ReturnType<typeof setInterval> | null = null;
let visibilityWatched = false;
/** 文件模式直接读写 JSON；只在首次迁移或显式本地模式读取旧缓存。 */
let skipLocalCache = false;
let defaultBootstrapPending = false;

const runtime: StoreRuntime = {
  get platform() { return platform; },
  set platform(value) { platform = value; },
  get persistQueue() { return persistQueue; },
  set persistQueue(value) { persistQueue = value; },
  get syncQueue() { return syncQueue; },
  set syncQueue(value) { syncQueue = value; },
  get lastSyncFingerprint() { return lastSyncFingerprint; },
  set lastSyncFingerprint(value) { lastSyncFingerprint = value; },
  get syncEpoch() { return syncEpoch; },
  set syncEpoch(value) { syncEpoch = value; },
  get localRevision() { return localRevision; },
  set localRevision(value) { localRevision = value; },
  get accountsPersistFailed() { return accountsPersistFailed; },
  set accountsPersistFailed(value) { accountsPersistFailed = value; },
  get groupsPersistFailed() { return groupsPersistFailed; },
  set groupsPersistFailed(value) { groupsPersistFailed = value; },
  get syncBaseline() { return syncBaseline; },
  set syncBaseline(value) { syncBaseline = value; },
  get writeApproval() { return writeApproval; },
  set writeApproval(value) { writeApproval = value; },
  get syncWriteVersion() { return syncWriteVersion; },
  set syncWriteVersion(value) { syncWriteVersion = value; },
  get pendingLocalWrites() { return pendingLocalWrites; },
  set pendingLocalWrites(value) { pendingLocalWrites = value; },
  get syncWriteInFlight() { return syncWriteInFlight; },
  set syncWriteInFlight(value) { syncWriteInFlight = value; },
  get syncWatchTimer() { return syncWatchTimer; },
  set syncWatchTimer(value) { syncWatchTimer = value; },
  get visibilityWatched() { return visibilityWatched; },
  set visibilityWatched(value) { visibilityWatched = value; },
  get defaultBootstrapPending() { return defaultBootstrapPending; },
  set defaultBootstrapPending(value) { defaultBootstrapPending = value; },
  get skipLocalCache() { return skipLocalCache; },
  set skipLocalCache(value) { skipLocalCache = value; },
};

const store: StoreAccess = {
  getState: () => useAccounts.getState(),
  setState: (state) => useAccounts.setState(state),
};

const services: StoreServices = {
  normalizeGroups: (values) => createStorageInstance.normalizeGroups(values),
  readLegacyLocalGroups: () => createStorageInstance.readLegacyLocalGroups(),
  clearLegacyLocalGroups: () => createStorageInstance.clearLegacyLocalGroups(),
  persistGroups: (groups) => createStorageInstance.persistGroups(groups),
  persist: (accounts) => createStorageInstance.persist(accounts),
  persistTrash: (trash) => createStorageInstance.persistTrash(trash),
  loadFromStorage: () => createStorageInstance.loadFromStorage(),
  loadTrashFromStorage: () => createStorageInstance.loadTrashFromStorage(),
  syncFingerprint: (path, accounts, groups, trash, preferences) => createSyncSourceInstance.syncFingerprint(path, accounts, groups, trash, preferences),
  readSyncSource: (path) => createSyncSourceInstance.readSyncSource(path),
  isMissingFile: (status) => createSyncSourceInstance.isMissingFile(status),
  resolveSyncPath: (input) => createSyncSourceInstance.resolveSyncPath(input),
  syncLockMessage: (info) => createSyncSourceInstance.syncLockMessage(info),
  applySourceSnapshot: (path, source, feedback) => createSyncSourceInstance.applySourceSnapshot(path, source, feedback),
  failSync: (message, extra) => createSyncSourceInstance.failSync(message, extra),
  writeSyncSnapshot: (epoch) => createSyncWriterInstance.writeSyncSnapshot(epoch),
  pollSyncSource: (epoch) => createSyncWatcherInstance.pollSyncSource(epoch),
  startSyncWatch: () => createSyncWatcherInstance.startSyncWatch(),
  stopSyncWatch: () => createSyncWatcherInstance.stopSyncWatch(),
  watchVisibility: () => createSyncWatcherInstance.watchVisibility(),
  scheduleSync: () => createSyncWatcherInstance.scheduleSync(),
};

const createStorageInstance = createStorage(runtime, services);
const createSyncSourceInstance = createSyncSource(runtime, services, store);
const createSyncWriterInstance = createSyncWriter(runtime, services, store);
const createSyncWatcherInstance = createSyncWatcher(runtime, services, store);

export function initPlatform(adapter: PlatformAdapter) {
  platform = adapter;
  persistQueue = Promise.resolve();
  syncQueue = Promise.resolve();
  lastSyncFingerprint = null;
  localRevision = 0;
  accountsPersistFailed = false;
  groupsPersistFailed = false;
  syncBaseline = null;
  writeApproval = null;
  syncWriteVersion = 0;
  skipLocalCache = false;
  defaultBootstrapPending = false;
  pendingLocalWrites = 0;
  syncWriteInFlight = false;
  syncEpoch += 1;
  services.stopSyncWatch();
  services.watchVisibility();
  const storedSyncPath = localStorage.getItem(SYNC_PATH_KEY) ?? "";
  const defaultPath = adapter.supportsFileSync ? adapter.getDefaultSyncPath?.() ?? "" : "";
  const syncPath = services.resolveSyncPath(storedSyncPath || defaultPath);
  // 旧值可能是别名路径：解析后回写，保证后续读写与锁都用同一规范路径。
  if (syncPath && syncPath !== storedSyncPath) localStorage.setItem(SYNC_PATH_KEY, syncPath);
  const syncEnabled = adapter.supportsFileSync === true
    && localStorage.getItem(SYNC_ENABLED_KEY) !== "false"
    && Boolean(syncPath);
  // 首次使用默认文档路径时迁移旧数据；以后文件丢失不静默重建。
  if (syncEnabled && !storedSyncPath && syncPath) {
    writeApproval = { path: syncPath, mode: "create" };
    defaultBootstrapPending = true;
  }
  // 不支持文件同步时只关闭运行态开关，保留用户偏好，升级 preload 后能恢复。
  useAccounts.setState({
    syncEnabled,
    syncPath,
    syncStatus: "idle",
    syncError: null,
    syncNotice: null,
    syncNeedsCreate: false,
  });
}

const initialAccentColor = loadAccentColor();
applyAccentColor(initialAccentColor);

export const useAccounts = create<AccountsState>((set, get) => {
  const createLoadActionsInstance = createLoadActions(set, get, runtime, services);
  const createAccountActionsInstance = createAccountActions(set, get, runtime, services);
  const createGroupActionsInstance = createGroupActions(set, get, services);
  const createTrashActionsInstance = createTrashActions(set, get, services);
  const createPreferenceActionsInstance = createPreferenceActions(set, get, services);
  const createSyncSetupActionsInstance = createSyncSetupActions(set, get, runtime, services);
  const createSyncResolutionActionsInstance = createSyncResolutionActions(set, get, runtime, services);
  return {
    accounts: [],
    trash: [],
    groups: [],
    searchQuery: "",
    showAddForm: false,
    showDataTransfer: false,
    showTrash: false,
    isDark: localStorage.getItem("goose-2fa-dark") !== null
      ? localStorage.getItem("goose-2fa-dark") === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches,
    isThemeLocked: localStorage.getItem("goose-2fa-dark") !== null,
    editMode: false,
    viewMode: loadViewMode(),
    selectedGroup: loadSelectedGroup(),
    accentColor: initialAccentColor,
    loadStatus: "idle",
    loadError: null,
    localCacheBroken: false,
    syncEnabled: localStorage.getItem(SYNC_ENABLED_KEY) === "true" && Boolean(localStorage.getItem(SYNC_PATH_KEY)),
    syncPath: localStorage.getItem(SYNC_PATH_KEY) ?? "",
    syncStatus: "idle",
    syncError: null,
    syncNotice: null,
    syncNeedsCreate: false,
    syncLockHeld: null,
    load: createLoadActionsInstance.load,
    recoverFromSource: createLoadActionsInstance.recoverFromSource,
    save: createAccountActionsInstance.save,
    setViewMode: createPreferenceActionsInstance.setViewMode,
    setSelectedGroup: createPreferenceActionsInstance.setSelectedGroup,
    setAccentColor: createPreferenceActionsInstance.setAccentColor,
    setSyncEnabled: createSyncSetupActionsInstance.setSyncEnabled,
    selectSyncPath: createSyncSetupActionsInstance.selectSyncPath,
    retrySync: createSyncResolutionActionsInstance.retrySync,
    clearSyncLock: createSyncResolutionActionsInstance.clearSyncLock,
    refreshSync: createSyncResolutionActionsInstance.refreshSync,
    createSyncFile: createSyncResolutionActionsInstance.createSyncFile,
    resolveSyncConflict: createSyncResolutionActionsInstance.resolveSyncConflict,
    reorderAccounts: createAccountActionsInstance.reorderAccounts,
    addAccount: createAccountActionsInstance.addAccount,
    importAccounts: createAccountActionsInstance.importAccounts,
    updateNote: createAccountActionsInstance.updateNote,
    updateRemark: createAccountActionsInstance.updateRemark,
    updateAccountGroup: createAccountActionsInstance.updateAccountGroup,
    createGroup: createGroupActionsInstance.createGroup,
    renameGroup: createGroupActionsInstance.renameGroup,
    deleteGroup: createGroupActionsInstance.deleteGroup,
    reorderGroups: createGroupActionsInstance.reorderGroups,
    removeAccount: createTrashActionsInstance.removeAccount,
    restoreAccount: createTrashActionsInstance.restoreAccount,
    permanentlyDelete: createTrashActionsInstance.permanentlyDelete,
    emptyTrash: createTrashActionsInstance.emptyTrash,
    incrementCounter: createAccountActionsInstance.incrementCounter,
    setSearchQuery: createPreferenceActionsInstance.setSearchQuery,
    setShowAddForm: createPreferenceActionsInstance.setShowAddForm,
    setShowDataTransfer: createPreferenceActionsInstance.setShowDataTransfer,
    setShowTrash: createPreferenceActionsInstance.setShowTrash,
    toggleDark: createPreferenceActionsInstance.toggleDark,
    toggleThemeLock: createPreferenceActionsInstance.toggleThemeLock,
    syncSystemDark: createPreferenceActionsInstance.syncSystemDark,
    setEditMode: createPreferenceActionsInstance.setEditMode,
  };
});
