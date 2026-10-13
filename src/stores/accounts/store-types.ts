import type { AccountData, NewAccountInput, VaultGroup } from "@/lib/types";
import type { PlatformAdapter } from "@/platform/types";
import { type SyncSnapshot, type SyncPreferences } from "@/lib/data-transfer";
import { type SyncLockInfo } from "../../../shared/sync-protocol";
import { type AccentColor } from "@/lib/accent-color";

export type SyncStatus = "idle" | "reading" | "writing" | "success" | "error" | "conflict";

export type SourceRead =
  | { status: "ok"; snapshot: SyncSnapshot; content: string; mtimeMs: number; size: number }
  | { status: "missing" | "empty" | "invalid" | "unresolved" | "error" };

export type ViewMode = "grid" | "compact" | "list";

export interface AccountsState {
  accounts: AccountData[];
  trash: AccountData[];
  groups: VaultGroup[];
  searchQuery: string;
  showAddForm: boolean;
  showDataTransfer: boolean;
  showTrash: boolean;
  isDark: boolean;
  isThemeLocked: boolean;
  editMode: boolean;
  viewMode: ViewMode;
  selectedGroup: string | null;
  accentColor: AccentColor;
  loadStatus: "idle" | "loading" | "ready" | "error";
  loadError: string | null;
  /** 本地缓存读不动：数据保留在原处，需用户显式选择恢复方式。 */
  localCacheBroken: boolean;
  syncEnabled: boolean;
  syncPath: string;
  syncStatus: SyncStatus;
  syncError: string | null;
  /** 非错误提示，例如已载入外部改动。 */
  syncNotice: string | null;
  /** 数据源文件缺失或为空，需要用户确认后新建。 */
  syncNeedsCreate: boolean;
  /** 最近一次写入被锁挡住；锁不会自动清理，需用户确认后显式清理。 */
  syncLockHeld: SyncLockInfo | null;

  load: () => Promise<void>;
  /** 本地缓存损坏时以数据源文件继续（不读不写本地缓存）。 */
  recoverFromSource: () => void;
  save: (accounts: AccountData[]) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedGroup: (groupId: string | null) => void;
  setAccentColor: (accentColor: AccentColor) => void;
  setSyncEnabled: (enabled: boolean) => void;
  selectSyncPath: (mode?: "existing" | "new") => Promise<void>;
  retrySync: () => void;
  /** 重新读取数据源文件（以文件为准）。 */
  refreshSync: () => void;
  /** 用户确认在缺失路径新建数据源文件，写入当前数据。 */
  createSyncFile: () => void;
  /** 用户显式清理残留锁文件（锁从不按时间自动清理）。 */
  clearSyncLock: () => void;
  /** 冲突处置：file = 以文件为准，local = 以本地为准并覆盖文件。 */
  resolveSyncConflict: (source: "file" | "local") => void;
  reorderAccounts: (activeId: string, overId: string) => void;
  addAccount: (input: NewAccountInput) => void;
  importAccounts: (inputs: NewAccountInput[], groups?: VaultGroup[]) => void;
  removeAccount: (id: string) => void;
  restoreAccount: (id: string) => void;
  permanentlyDelete: (id: string) => void;
  emptyTrash: () => void;
  updateNote: (id: string, note: string) => void;
  updateRemark: (id: string, remark: string) => void;
  updateAccountGroup: (id: string, groupId: string | null) => void;
  createGroup: (name: string) => string | null;
  renameGroup: (id: string, name: string) => boolean;
  deleteGroup: (id: string) => void;
  reorderGroups: (activeId: string, overId: string) => void;
  incrementCounter: (id: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  setShowAddForm: (show: boolean) => void;
  setShowDataTransfer: (show: boolean) => void;
  setShowTrash: (show: boolean) => void;
  toggleDark: () => void;
  toggleThemeLock: () => void;
  syncSystemDark: (isDark: boolean) => void;
  setEditMode: (edit: boolean) => void;
}

export interface StoreRuntime {
  platform: PlatformAdapter;
  persistQueue: Promise<void>;
  syncQueue: Promise<void>;
  lastSyncFingerprint: string | null;
  syncEpoch: number;
  localRevision: number;
  accountsPersistFailed: boolean;
  groupsPersistFailed: boolean;
  syncBaseline: { path: string; content: string; mtimeMs: number; size: number } | null;
  writeApproval: { path: string; mode: "create" | "overwrite" } | null;
  syncWriteVersion: number;
  pendingLocalWrites: number;
  syncWriteInFlight: boolean;
  syncWatchTimer: ReturnType<typeof setInterval> | null;
  visibilityWatched: boolean;
  skipLocalCache: boolean;
  defaultBootstrapPending: boolean;
}

export interface StoreServices {
  normalizeGroups(values: unknown): VaultGroup[];
  readLegacyLocalGroups(): VaultGroup[];
  clearLegacyLocalGroups(): void;
  persistGroups(groups: VaultGroup[]): Promise<boolean>;
  persist(accounts: AccountData[]): Promise<boolean>;
  persistTrash(trash: AccountData[]): void;
  loadFromStorage(): Promise<AccountData[]>;
  loadTrashFromStorage(): AccountData[];
  syncFingerprint(path: string, accounts: AccountData[], groups: VaultGroup[], trash: AccountData[], preferences?: SyncPreferences): string;
  readSyncSource(path: string): Promise<SourceRead>;
  isMissingFile(status: SourceRead["status"]): boolean;
  resolveSyncPath(input: string): string;
  syncLockMessage(info: SyncLockInfo): string;
  applySourceSnapshot(path: string, source: Extract<SourceRead, { status: "ok" }>, feedback: { status: SyncStatus; error: string | null; notice: string | null }): void;
  failSync(message: string, extra?: { syncNeedsCreate?: boolean }): void;
  writeSyncSnapshot(epoch?: number): Promise<void>;
  pollSyncSource(epoch: number): Promise<void>;
  startSyncWatch(): void;
  stopSyncWatch(): void;
  watchVisibility(): void;
  scheduleSync(): void;
}

export type StoreGet = () => AccountsState;
export type StoreSet = (state: Partial<AccountsState>) => void;
export interface StoreAccess {
  getState: StoreGet;
  setState: StoreSet;
}
