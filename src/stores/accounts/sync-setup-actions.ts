import type { AccountsState, StoreGet, StoreSet, StoreRuntime, StoreServices } from "./store-types";
import { SYNC_ENABLED_KEY, SYNC_PATH_KEY } from "./preferences";

export function createSyncSetupActions(set: StoreSet, get: StoreGet, runtime: StoreRuntime, services: StoreServices): Pick<AccountsState, "setSyncEnabled" | "selectSyncPath"> {
  return {
    setSyncEnabled: (enabled) => {
      const path = localStorage.getItem(SYNC_PATH_KEY) ?? "";
      if (enabled && (!runtime.platform.supportsFileSync || !path)) {
        set({ syncEnabled: false, syncError: "请先选择数据源文件路径" });
        return;
      }
      localStorage.setItem(SYNC_ENABLED_KEY, String(enabled));
      if (!enabled) {
        runtime.syncEpoch += 1;
        runtime.writeApproval = null;
        services.stopSyncWatch();
        runtime.skipLocalCache = false;
        set({ syncEnabled: false, syncStatus: "idle", syncError: null, syncNotice: null });
        if (get().loadStatus === "ready") {
          services.persist(get().accounts);
          void services.persistGroups(get().groups);
          services.persistTrash(get().trash);
        } else {
          void get().load();
        }
        return;
      }
      runtime.lastSyncFingerprint = null;
      runtime.skipLocalCache = true;
      runtime.accountsPersistFailed = false;
      runtime.groupsPersistFailed = false;
      set({ syncEnabled: true, syncStatus: "reading", syncError: null, syncNotice: null });
      // 开启后以文件为准：先读一次，避免用内存数据覆盖文件。
      void (async () => {
        const epoch = runtime.syncEpoch;
        const source = await services.readSyncSource(path);
        if (epoch !== runtime.syncEpoch || !get().syncEnabled || get().syncPath !== path) return;
        if (source.status === "ok") {
          services.applySourceSnapshot(path, source, {
            status: "success", error: null, notice: "已启用文件同步，以文件内容为准。",
          });
          return;
        }
        if (services.isMissingFile(source.status)) {
          const approved = runtime.writeApproval?.path === path && runtime.writeApproval.mode === "create";
          if (!approved) {
            set({
              syncStatus: "error",
              syncError: "数据源文件不存在或为空，未写入。请确认路径或点击「新建数据源文件」。",
              syncNotice: null,
              syncNeedsCreate: true,
            });
            return;
          }
          runtime.skipLocalCache = true;
          set({ syncStatus: "idle" });
          services.scheduleSync();
          return;
        }
        set({
          syncStatus: "error",
          syncError: "数据源文件无法解析，已停止写入以免覆盖。请确认路径。",
          syncNotice: null,
        });
      })();
    },

    selectSyncPath: async (mode) => {
      if (!runtime.platform.supportsFileSync || !runtime.platform.selectSyncPath) return;
      const picked = await runtime.platform.selectSyncPath(mode);
      if (!picked) return;
      const path = services.resolveSyncPath(picked);
      if (!path) return;
      localStorage.setItem(SYNC_PATH_KEY, path);
      runtime.lastSyncFingerprint = null;
      runtime.syncBaseline = null;
      runtime.syncEpoch += 1;
      services.stopSyncWatch();
      set({ syncPath: path, syncError: null, syncStatus: "reading", syncNotice: null, syncNeedsCreate: false });
      // 选中已有的数据源文件时以文件为准；绝不能把旧内存写进新路径。
      const source = await services.readSyncSource(path);
      if (get().syncPath !== path) return;
      if (source.status === "ok") {
        if (!get().syncEnabled) {
          // 同步关闭时只记住路径：不动本地数据，文件与本地库的取舍留给开启时的冲突流程。
          set({
            syncStatus: "idle",
            syncError: null,
            syncNotice: "已记住路径，开启同步后以该文件为准。",
            syncNeedsCreate: false,
          });
          return;
        }
        services.applySourceSnapshot(path, source, {
          status: "success",
          error: null,
          notice: "已切换到数据源文件（内容以文件为准）。",
        });
        return;
      }
      if (services.isMissingFile(source.status)) {
        // 用户刚刚选定该路径（保存对话框），允许创建新文件。
        runtime.writeApproval = { path, mode: "create" };
        set({ syncStatus: "idle", syncError: null, syncNotice: "该路径还没有数据文件，开启同步后会写入当前数据。", syncNeedsCreate: true });
        if (get().syncEnabled) {
          runtime.skipLocalCache = true;
          set({ loadStatus: "ready", loadError: null });
          services.scheduleSync();
        }
        return;
      }
      set({
        syncStatus: "error",
        syncError: "所选文件无法解析，已保留当前数据。请确认选择的是 goose-2fa 数据源文件。",
        syncNotice: null,
        syncNeedsCreate: false,
      });
    }
  };
}
