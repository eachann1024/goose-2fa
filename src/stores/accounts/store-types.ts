import type { AccountData, NewAccountInput, VaultGroup } from "@/lib/types";
import type { PlatformAdapter } from "@/platform/types";
import { type AccentColor } from "@/lib/accent-color";

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

  load: () => Promise<void>;
  save: (accounts: AccountData[]) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedGroup: (groupId: string | null) => void;
  setAccentColor: (accentColor: AccentColor) => void;
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
  incrementCounter: (id: string) => void;
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
}

export interface StoreServices {
  normalizeGroups(values: unknown): VaultGroup[];
  readLegacyLocalGroups(): VaultGroup[];
  clearLegacyLocalGroups(): void;
  persistGroups(groups: VaultGroup[]): void;
  persist(accounts: AccountData[]): void;
  persistTrash(trash: AccountData[]): void;
  loadFromStorage(): Promise<AccountData[]>;
  loadTrashFromStorage(): AccountData[];
}

export type StoreGet = () => AccountsState;
export type StoreSet = (state: Partial<AccountsState>) => void;
export interface StoreAccess {
  getState: StoreGet;
  setState: StoreSet;
}
