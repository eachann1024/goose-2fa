import { syncLockPath } from "../../../shared/sync-protocol";
import { keepHotpFloor } from "../../../shared/vault-ops";
import type { AccountsState, StoreGet, StoreSet, StoreRuntime, StoreServices } from "./store-types";

export function createSyncResolutionActions(set: StoreSet, get: StoreGet, runtime: StoreRuntime, services: StoreServices): Pick<AccountsState, "retrySync" | "clearSyncLock" | "refreshSync" | "createSyncFile" | "resolveSyncConflict"> {
  return {
    retrySync: () => {
      if (!get().syncEnabled) return;
      runtime.lastSyncFingerprint = null;
      set({ syncError: null, syncNotice: null });
      if (runtime.skipLocalCache) {
        // 本地缓存已损坏且用户选择了以文件继续：不要再拿内存去覆盖那个坏值。
        services.scheduleSync();
        return;
      }
      const accounts = get().accounts.map((account) => ({ ...account }));
      const groups = get().groups.map((group) => ({ ...group }));
      runtime.persistQueue = runtime.persistQueue.then(async () => {
        try {
          await Promise.resolve(runtime.platform.saveAccounts(accounts));
          runtime.accountsPersistFailed = false;
          await Promise.resolve(runtime.platform.saveGroups(groups));
          runtime.groupsPersistFailed = false;
        } catch (error) {
          runtime.accountsPersistFailed = true;
          console.error("[goose-2fa] retry local save failed:", error);
          runtime.platform.showNotification("本地数据保存失败，请检查存储权限后重试");
        }
      });
      runtime.localRevision += 1;
      services.scheduleSync();
    },

    /** 用户显式清理残留锁。锁从不按时间自动清理；清完再按内容 CAS 重试，外部改动仍会被拒绝。 */
    clearSyncLock: () => {
      const path = get().syncPath;
      if (!path || !runtime.platform.clearSyncLock) return;
      const removed = runtime.platform.clearSyncLock(syncLockPath(path));
      if (!removed) {
        set({ syncError: "没有找到锁文件，可能已被持有者释放。", syncNotice: null });
        return;
      }
      set({
        syncLockHeld: null,
        syncStatus: "idle",
        syncError: null,
        syncNotice: "已清理残留锁，正在重试保存。",
      });
      services.scheduleSync();
    },

    refreshSync: () => {
      const path = get().syncPath;
      if (!path || !runtime.platform.readSyncFile || get().loadStatus === "loading") return;
      const epoch = runtime.syncEpoch;
      set({ syncStatus: "reading", syncError: null, syncNotice: null });
      void (async () => {
        const source = await services.readSyncSource(path);
        if (epoch !== runtime.syncEpoch || get().syncPath !== path) return;
        if (source.status === "ok") {
          services.applySourceSnapshot(path, source, {
            status: "success",
            error: null,
            notice: "已按数据源文件刷新。",
          });
          return;
        }
        set({
          syncStatus: "error",
          syncError: services.isMissingFile(source.status)
            ? "数据源文件不存在或为空。请确认路径，或点击「新建数据源文件」。"
            : "数据源文件无法解析，已保留当前数据。",
          syncNeedsCreate: services.isMissingFile(source.status),
        });
      })();
    },

    createSyncFile: () => {
      const path = get().syncPath;
      if (!path || !runtime.platform.writeSyncFile) return;
      runtime.writeApproval = { path, mode: "create" };
      runtime.lastSyncFingerprint = null;
      runtime.syncBaseline = null;
      runtime.skipLocalCache = true;
      set({ loadStatus: "ready", loadError: null, syncStatus: "idle", syncError: null, syncNotice: "将在该路径新建数据源文件。" });
      services.scheduleSync();
    },

    resolveSyncConflict: (source) => {
      if (source === "file") {
        get().refreshSync();
        return;
      }
      const path = get().syncPath;
      if (!path || !runtime.platform.writeSyncFile) return;
      set({ syncStatus: "idle", syncError: null, syncNotice: "将以本地数据覆盖数据源文件。" });
      runtime.writeApproval = { path, mode: "overwrite" };
      runtime.lastSyncFingerprint = null;
      void (async () => {
        // 覆盖前先按文件抬高 HOTP 计数器下限：外部已消费的计数器不能被本地旧值写回。
        const fileSource = await services.readSyncSource(path);
        if (get().syncPath !== path) return;
        const merged = fileSource.status === "ok"
          ? keepHotpFloor(get().accounts, fileSource.snapshot.accounts)
          : { accounts: get().accounts, raised: false };
        if (merged.raised) {
          services.persist(merged.accounts);
          set({ accounts: merged.accounts });
        } else {
          services.scheduleSync();
        }
      })();
    }
  };
}
