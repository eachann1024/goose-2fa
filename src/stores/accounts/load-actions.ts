import { pruneExpiredTrash } from "../../../shared/vault-ops";
import { normalizeStoredAccounts } from "@/lib/account-validation";
import { resolveSelectedGroup } from "@/lib/groups";
import type { AccountsState, StoreGet, StoreSet, StoreRuntime, StoreServices } from "./store-types";
import { GROUP_KEY } from "./preferences";

export function createLoadActions(set: StoreSet, get: StoreGet, runtime: StoreRuntime, services: StoreServices): Pick<AccountsState, "load" | "recoverFromSource"> {
  return {
    load: async () => {
      if (get().loadStatus === "loading") return;
      set({ loadStatus: "loading", loadError: null });
      try {
        // 打开前先完成已排队的保存，再重新读文件，避免旧快照覆盖刚刚保存的内容。
        await runtime.persistQueue;
        await runtime.syncQueue;
        const syncPath = get().syncPath;
        const fileMode = get().syncEnabled && Boolean(syncPath) && Boolean(runtime.platform.readSyncFile);
        if (fileMode) {
          const epoch = runtime.syncEpoch;
          const source = await services.readSyncSource(syncPath);
          if (epoch !== runtime.syncEpoch || get().syncPath !== syncPath) return;
          if (source.status === "ok") {
            services.applySourceSnapshot(syncPath, source, {
              status: "success", error: null, notice: "已载入数据源文件内容。",
            });
            return;
          }
          // 只有首次默认文档文件尚不存在才迁移旧库；空文件、坏文件及以后丢失的文件均不覆盖。
          const bootstrap = runtime.defaultBootstrapPending && source.status === "missing"
            && runtime.writeApproval?.path === syncPath && runtime.writeApproval.mode === "create";
          if (!bootstrap) {
            const message = source.status === "unresolved"
              ? "数据源路径无法解析，请在设置中重新选择文件。"
              : services.isMissingFile(source.status)
                ? "数据源文件不存在或为空，请在设置中确认路径或新建文件。"
                : "数据源文件无法解析或读取，请在设置中确认路径。";
            runtime.skipLocalCache = true;
            set({
              loadStatus: "error", loadError: message,
              syncStatus: "error", syncError: message, syncNotice: null,
              syncNeedsCreate: services.isMissingFile(source.status),
            });
            services.startSyncWatch();
            return;
          }
        }

        runtime.defaultBootstrapPending = false;
        runtime.skipLocalCache = false;
        if (!fileMode) {
          // 本地模式重试先保存尚在内存中的数据。
          if (runtime.groupsPersistFailed) void services.persistGroups(get().groups);
          if (runtime.accountsPersistFailed) services.persist(get().accounts);
          await runtime.persistQueue;
          if (runtime.accountsPersistFailed || runtime.groupsPersistFailed) throw new Error("本地数据尚未保存成功");
        }
        const platformGroups = services.normalizeGroups(await Promise.resolve(runtime.platform.loadGroups()));
        const legacyGroups = services.readLegacyLocalGroups();
        const groups = platformGroups.length ? platformGroups : legacyGroups;
        if (!fileMode && platformGroups.length === 0 && legacyGroups.length > 0) void services.persistGroups(groups);
        else if (!fileMode && platformGroups.length > 0 && legacyGroups.length > 0) services.clearLegacyLocalGroups();
        const validGroupIds = new Set(groups.map((group) => group.id));
        const storedTrash = normalizeStoredAccounts(services.loadTrashFromStorage(), validGroupIds);
        const trash = pruneExpiredTrash(storedTrash);
        if (!fileMode && trash.length !== storedTrash.length) services.persistTrash(trash);
        const loaded = await services.loadFromStorage();
        const accounts = normalizeStoredAccounts(loaded, validGroupIds);
        const selectedGroup = resolveSelectedGroup(get().selectedGroup, groups, accounts);
        if (selectedGroup) localStorage.setItem(GROUP_KEY, selectedGroup);
        else localStorage.removeItem(GROUP_KEY);
        runtime.skipLocalCache = fileMode;
        set({ accounts, trash, groups, selectedGroup, loadStatus: "ready", loadError: null, localCacheBroken: false, syncStatus: "idle", syncError: null });
        if (fileMode) {
          services.scheduleSync();
          await runtime.syncQueue;
          services.startSyncWatch();
        }
      } catch (error) {
        console.error("[goose-2fa] load failed:", error);
        set({
          loadStatus: "error", loadError: "无法读取原有账户，已有数据不会被覆盖。请重试或在设置中选择数据文件。",
          localCacheBroken: true,
        });
      }
    },

    recoverFromSource: () => { void get().load(); },
  };
}
