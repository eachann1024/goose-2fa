import { LEGACY_GROUPS_KEY } from "./preferences";
import type { AccountData, VaultGroup } from "@/lib/types";
import { normalizeStoredAccounts } from "@/lib/account-validation";
import type { StoreRuntime, StoreServices } from "./store-types";

export function createStorage(runtime: StoreRuntime, services: StoreServices) {
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

  function persistGroups(groups: VaultGroup[]): Promise<boolean> {
    const snapshot = groups.map((group) => ({ ...group }));
    const operation = runtime.persistQueue.then(async () => {
      if (runtime.skipLocalCache) return true;
      runtime.pendingLocalWrites += 1;
      try {
        await Promise.resolve(runtime.platform.saveGroups(snapshot));
        clearLegacyLocalGroups();
        runtime.groupsPersistFailed = false;
        return true;
      } catch (err) {
        runtime.groupsPersistFailed = true;
        console.error("[goose-2fa] persist groups failed:", err);
        runtime.platform.showNotification("分组保存失败，请检查存储权限后重试");
        return false;
      } finally {
        runtime.pendingLocalWrites -= 1;
      }
    });
    runtime.persistQueue = operation.then(() => undefined);
    runtime.localRevision += 1;
    return operation;
  }

  function persist(accounts: AccountData[]): Promise<boolean> {
    const snapshot = accounts.map((account) => ({ ...account }));
    const operation = runtime.persistQueue.then(async () => {
      if (runtime.skipLocalCache) return true;
      runtime.pendingLocalWrites += 1;
      try {
        await Promise.resolve(runtime.platform.saveAccounts(snapshot));
        runtime.accountsPersistFailed = false;
        return true;
      } catch (err) {
        runtime.accountsPersistFailed = true;
        console.error("[goose-2fa] persist failed:", err);
        runtime.platform.showNotification("账户保存失败，请检查存储权限后重试");
        return false;
      } finally {
        runtime.pendingLocalWrites -= 1;
      }
    });
    runtime.persistQueue = operation.then(() => undefined);
    runtime.localRevision += 1;
    void operation.then(() => services.scheduleSync());
    return operation;
  }

  function persistTrash(trash: AccountData[]) {
    if (runtime.skipLocalCache) return;
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
