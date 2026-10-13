import { normalizeStoredAccounts } from "@/lib/account-validation";
import { resolveSelectedGroup } from "@/lib/groups";
import type { AccountsState, StoreGet, StoreSet, StoreRuntime, StoreServices } from "./store-types";
import { GROUP_KEY } from "./preferences";

export function createLoadActions(set: StoreSet, get: StoreGet, runtime: StoreRuntime, services: StoreServices): Pick<AccountsState, "load"> {
  return {
    load: async () => {
      if (get().loadStatus === "loading") return;
      set({ loadStatus: "loading", loadError: null });
      try {
        const platformGroups = services.normalizeGroups(await Promise.resolve(runtime.platform.loadGroups()));
        const legacyGroups = services.readLegacyLocalGroups();
        // 平台存储优先；若平台尚无分组，迁移旧 localStorage 数据
        let groups = platformGroups;
        if (groups.length === 0 && legacyGroups.length > 0) {
          groups = legacyGroups;
          services.persistGroups(groups);
        } else if (platformGroups.length > 0 && legacyGroups.length > 0) {
          services.clearLegacyLocalGroups();
        }
        const validGroupIds = new Set(groups.map((group) => group.id));
        const trash = normalizeStoredAccounts(services.loadTrashFromStorage(), validGroupIds);
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const validTrash = trash.filter((a) => (a.deletedAt ?? 0) > thirtyDaysAgo);
        if (validTrash.length !== trash.length) services.persistTrash(validTrash);
        const loaded = await services.loadFromStorage();
        const accounts = normalizeStoredAccounts(loaded, validGroupIds);
        const selectedGroup = resolveSelectedGroup(get().selectedGroup, groups, accounts);
        if (selectedGroup !== get().selectedGroup) {
          if (selectedGroup) localStorage.setItem(GROUP_KEY, selectedGroup);
          else localStorage.removeItem(GROUP_KEY);
        }
        set({ accounts, trash: validTrash, groups, selectedGroup, loadStatus: "ready" });
      } catch (error) {
        console.error("[goose-2fa] load failed:", error);
        set({
          loadStatus: "error",
          loadError: "无法读取本地账户，请重试。已有数据不会被覆盖。",
        });
      }
    }
  };
}
