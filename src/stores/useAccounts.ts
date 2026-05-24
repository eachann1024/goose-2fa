import { create } from "zustand";
import type { AccountData, NewAccountInput } from "@/lib/types";
import type { PlatformAdapter } from "@/platform/types";

let platform: PlatformAdapter;

export function initPlatform(adapter: PlatformAdapter) {
  platform = adapter;
}

interface AccountsState {
  accounts: AccountData[];
  trash: AccountData[];
  searchQuery: string;
  showAddForm: boolean;
  showDataTransfer: boolean;
  showTrash: boolean;
  isDark: boolean;
  isThemeLocked: boolean;
  editMode: boolean;

  load: () => Promise<void>;
  save: (accounts: AccountData[]) => void;
  addAccount: (input: NewAccountInput) => void;
  importAccounts: (inputs: NewAccountInput[]) => void;
  removeAccount: (id: string) => void;
  restoreAccount: (id: string) => void;
  permanentlyDelete: (id: string) => void;
  emptyTrash: () => void;
  updateNote: (id: string, note: string) => void;
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

function persist(accounts: AccountData[]) {
  const result = platform.saveAccounts(accounts);
  if (result instanceof Promise) {
    result.catch((err) => console.error("[goose-2fa] persist failed:", err));
  }
}

function persistTrash(trash: AccountData[]) {
  localStorage.setItem("goose-2fa-trash", JSON.stringify(trash));
}

async function loadFromStorage(): Promise<AccountData[]> {
  return platform.loadAccounts();
}

function loadTrashFromStorage(): AccountData[] {
  try {
    const raw = localStorage.getItem("goose-2fa-trash");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useAccounts = create<AccountsState>((set, get) => ({
  accounts: [],
  trash: [],
  searchQuery: "",
  showAddForm: false,
  showDataTransfer: false,
  showTrash: false,
  isDark: localStorage.getItem("goose-2fa-dark") !== null
    ? localStorage.getItem("goose-2fa-dark") === "true"
    : window.matchMedia("(prefers-color-scheme: dark)").matches,
  isThemeLocked: localStorage.getItem("goose-2fa-dark") !== null,
  editMode: false,

  load: async () => {
    const trash = loadTrashFromStorage();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const validTrash = trash.filter((a) => (a.deletedAt ?? 0) > thirtyDaysAgo);
    if (validTrash.length !== trash.length) persistTrash(validTrash);
    const accounts = await loadFromStorage();
    set({ accounts, trash: validTrash });
  },

  save: (accounts) => {
    persist(accounts);
    set({ accounts });
  },

  addAccount: (input) => {
    const meta: import("@/lib/types").AccountMeta = {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      platform: navigator.platform,
    };

    const displayName = input.issuer
      ? `${input.issuer} (${input.name})`
      : input.name;

    const account: AccountData = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      meta,
      originalName: displayName,
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          account.meta = {
            ...account.meta,
            location: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
          };
          const updated = get().accounts.map((a) =>
            a.id === account.id ? account : a,
          );
          persist(updated);
          set({ accounts: updated });
        },
        () => {},
        { timeout: 5000, maximumAge: 300000 },
      );
    }

    const next = [...get().accounts, account];
    persist(next);
    set({ accounts: next, showAddForm: false });
  },

  importAccounts: (inputs) => {
    const now = Date.now();
    const newAccounts = inputs.map((input, i) => ({
      ...input,
      id: crypto.randomUUID(),
      createdAt: now + i,
    }));
    const next = [...get().accounts, ...newAccounts];
    persist(next);
    set({ accounts: next });
  },

  updateNote: (id, note) => {
    const next = get().accounts.map((a) =>
      a.id === id ? { ...a, note } : a,
    );
    persist(next);
    set({ accounts: next });
  },

  removeAccount: (id) => {
    const account = get().accounts.find((a) => a.id === id);
    const next = get().accounts.filter((a) => a.id !== id);
    persist(next);
    if (account) {
      const trashed = { ...account, deletedAt: Date.now() };
      const nextTrash = [...get().trash, trashed];
      persistTrash(nextTrash);
      set({ accounts: next, trash: nextTrash });
    } else {
      set({ accounts: next });
    }
  },

  restoreAccount: (id) => {
    const account = get().trash.find((a) => a.id === id);
    if (!account) return;
    const { deletedAt: _, ...restored } = account;
    const nextTrash = get().trash.filter((a) => a.id !== id);
    const nextAccounts = [...get().accounts, restored as AccountData];
    persist(nextAccounts);
    persistTrash(nextTrash);
    set({ accounts: nextAccounts, trash: nextTrash });
  },

  permanentlyDelete: (id) => {
    const nextTrash = get().trash.filter((a) => a.id !== id);
    persistTrash(nextTrash);
    set({ trash: nextTrash });
  },

  emptyTrash: () => {
    persistTrash([]);
    set({ trash: [] });
  },

  incrementCounter: (id) => {
    const next = get().accounts.map((a) =>
      a.id === id ? { ...a, counter: a.counter + 1 } : a,
    );
    persist(next);
    set({ accounts: next });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setShowAddForm: (showAddForm) => set({ showAddForm }),
  setShowDataTransfer: (showDataTransfer) => set({ showDataTransfer }),
  setShowTrash: (showTrash) => set({ showTrash }),

  toggleDark: () => {
    const next = !get().isDark;
    localStorage.setItem("goose-2fa-dark", String(next));
    document.documentElement.classList.toggle("dark", next);
    set({ isDark: next, isThemeLocked: true });
  },

  toggleThemeLock: () => {
    if (get().isThemeLocked) {
      // 解锁：移除手动偏好，跟随系统
      localStorage.removeItem("goose-2fa-dark");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", systemDark);
      set({ isThemeLocked: false, isDark: systemDark });
    } else {
      // 锁定：固定当前主题
      localStorage.setItem("goose-2fa-dark", String(get().isDark));
      set({ isThemeLocked: true });
    }
  },

  syncSystemDark: (isDark) => {
    document.documentElement.classList.toggle("dark", isDark);
    set({ isDark });
  },

  setEditMode: (editMode) => set({ editMode }),
}));
