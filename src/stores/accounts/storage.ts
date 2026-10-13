import { LEGACY_GROUPS_KEY } from "./preferences";
import type { AccountData, VaultGroup } from "@/lib/types";
import { normalizeStoredAccounts } from "@/lib/account-validation";
import type { StoreRuntime } from "./store-types";

export function createStorage(runtime: StoreRuntime) {
  function normalizeGroups(values: unknown): VaultGroup[] {
    if (!Array.isArray(values)) return [];
    return values
      .filter((g): g is VaultGroup => {
        if (!g || typeof g !== "object") return false;
        const group = g as VaultGroup;
        return typeof group.id === "string" && typeof group.name === "string";
      })
      .map((g, i) => ({
        id: g.id,
        name: g.name,
        order: typeof g.order === "number" ? g.order : i,
        createdAt: typeof g.createdAt === "number" ? g.createdAt : Date.now(),
      }));
  }

  function readLegacyLocalGroups(): VaultGroup[] {
    try {
      const raw = localStorage.getItem(LEGACY_GROUPS_KEY);
      if (!raw) return [];
      return normalizeGroups(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function clearLegacyLocalGroups() {
    localStorage.removeItem(LEGACY_GROUPS_KEY);
  }

  function persistGroups(groups: VaultGroup[]) {
    const snapshot = groups.map((group) => ({ ...group }));
    runtime.persistQueue = runtime.persistQueue
      .then(() => Promise.resolve(runtime.platform.saveGroups(snapshot)))
      .then(() => {
        clearLegacyLocalGroups();
      })
      .catch((err) => {
        console.error("[goose-2fa] persist groups failed:", err);
        runtime.platform.showNotification("分组保存失败，请检查存储权限后重试");
      });
  }

  function persist(accounts: AccountData[]) {
    const snapshot = accounts.map((account) => ({ ...account }));
    runtime.persistQueue = runtime.persistQueue
      .then(() => Promise.resolve(runtime.platform.saveAccounts(snapshot)))
      .catch((err) => {
        console.error("[goose-2fa] persist failed:", err);
        runtime.platform.showNotification("账户保存失败，请检查存储权限后重试");
      });
  }

  function persistTrash(trash: AccountData[]) {
    localStorage.setItem("goose-2fa-trash", JSON.stringify(trash));
  }

  async function loadFromStorage(): Promise<AccountData[]> {
    return runtime.platform.loadAccounts();
  }

  function loadTrashFromStorage(): AccountData[] {
    try {
      const raw = localStorage.getItem("goose-2fa-trash");
      return raw ? normalizeStoredAccounts(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  return { normalizeGroups, readLegacyLocalGroups, clearLegacyLocalGroups, persistGroups, persist, persistTrash, loadFromStorage, loadTrashFromStorage };
}
