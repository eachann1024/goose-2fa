import { canEditVault } from "./write-guard";
import { applyAccentColor, DEFAULT_ACCENT_COLOR, normalizeAccentColor, type AccentColor } from "@/lib/accent-color";
import type { SyncPreferences } from "@/lib/data-transfer";
import type { AccountsState, StoreGet, StoreSet, StoreServices, ViewMode } from "./store-types";

export const VIEW_MODE_KEY = "goose-2fa-view";
export const GROUP_KEY = "goose-2fa-group";
export const ACCENT_COLOR_KEY = "goose-2fa-accent";
export const SYNC_ENABLED_KEY = "goose-2fa-sync-enabled";
export const SYNC_PATH_KEY = "goose-2fa-sync-path";
/** 旧版分组曾落在 localStorage；迁移到平台存储后删除 */
export const LEGACY_GROUPS_KEY = "goose-2fa-groups";
/** 兼容旧 issuer 侧栏选中，读取一次后清除 */
export const LEGACY_CATEGORY_KEY = "goose-2fa-category";

export function loadViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  if (stored === "compact" || stored === "list" || stored === "grid") return stored;
  return "compact";
}

export function loadSelectedGroup(): string | null {
  const stored = localStorage.getItem(GROUP_KEY);
  if (stored) return stored;
  // 旧分类键不再映射到一级分组，直接丢弃以免脏状态
  if (localStorage.getItem(LEGACY_CATEGORY_KEY)) {
    localStorage.removeItem(LEGACY_CATEGORY_KEY);
  }
  return null;
}

export function loadAccentColor(): AccentColor {
  return normalizeAccentColor(localStorage.getItem(ACCENT_COLOR_KEY) ?? DEFAULT_ACCENT_COLOR);
}

export function snapshotPreferences(state: AccountsState): SyncPreferences {
  return {
    viewMode: state.viewMode,
    selectedGroup: state.selectedGroup,
    accentColor: state.accentColor,
    isDark: state.isDark,
    isThemeLocked: state.isThemeLocked,
  };
}

export function applyFilePreferences(preferences: SyncPreferences): SyncPreferences {
  const next = { ...preferences };
  if (!next.isThemeLocked) next.isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  localStorage.setItem(VIEW_MODE_KEY, next.viewMode);
  localStorage.setItem(ACCENT_COLOR_KEY, next.accentColor);
  if (next.isThemeLocked) localStorage.setItem("goose-2fa-dark", String(next.isDark));
  else localStorage.removeItem("goose-2fa-dark");
  applyAccentColor(next.accentColor);
  document.documentElement.classList.toggle("dark", next.isDark);
  return next;
}

export function createPreferenceActions(set: StoreSet, get: StoreGet, services: StoreServices): Pick<AccountsState, "setViewMode" | "setSelectedGroup" | "setAccentColor" | "setSearchQuery" | "setShowAddForm" | "setShowDataTransfer" | "setShowTrash" | "toggleDark" | "toggleThemeLock" | "syncSystemDark" | "setEditMode"> {
  return {
    setViewMode: (mode) => {
      if (!canEditVault(get())) return;
      localStorage.setItem(VIEW_MODE_KEY, mode);
      set({ viewMode: mode });
      services.scheduleSync();
    },

    setSelectedGroup: (groupId) => {
      if (!canEditVault(get())) return;
      if (groupId) localStorage.setItem(GROUP_KEY, groupId);
      else localStorage.removeItem(GROUP_KEY);
      set({ selectedGroup: groupId });
      services.scheduleSync();
    },

    setAccentColor: (accentColor) => {
      if (!canEditVault(get())) return;
      const normalized = normalizeAccentColor(accentColor);
      localStorage.setItem(ACCENT_COLOR_KEY, normalized);
      applyAccentColor(normalized);
      set({ accentColor: normalized });
      services.scheduleSync();
    },

    setSearchQuery: (searchQuery) => {
      set({ searchQuery });
    },

    setShowAddForm: (showAddForm) => set({ showAddForm }),

    setShowDataTransfer: (showDataTransfer) => set({ showDataTransfer }),

    setShowTrash: (showTrash) => set({ showTrash }),

    toggleDark: () => {
      if (!canEditVault(get())) return;
      const next = !get().isDark;
      localStorage.setItem("goose-2fa-dark", String(next));
      document.documentElement.classList.toggle("dark", next);
      set({ isDark: next, isThemeLocked: true });
      services.scheduleSync();
    },

    toggleThemeLock: () => {
      if (!canEditVault(get())) return;
      if (get().isThemeLocked) {
        localStorage.removeItem("goose-2fa-dark");
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", systemDark);
        set({ isThemeLocked: false, isDark: systemDark });
      } else {
        localStorage.setItem("goose-2fa-dark", String(get().isDark));
        set({ isThemeLocked: true });
      }
      services.scheduleSync();
    },

    syncSystemDark: (isDark) => {
      document.documentElement.classList.toggle("dark", isDark);
      set({ isDark });
      services.scheduleSync();
    },

    setEditMode: (editMode) => set({ editMode })
  };
}
