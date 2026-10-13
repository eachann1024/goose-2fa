import { isSameSyncContent } from "../../../shared/sync-protocol";
import type { StoreRuntime, StoreServices, StoreAccess } from "./store-types";

const SYNC_WATCH_INTERVAL = 3000;

export function createSyncWatcher(runtime: StoreRuntime, services: StoreServices, store: StoreAccess) {
  /** 轮询数据源文件，载入外部改动；写盘前后的自身写入由内容比对排除。 */
  async function pollSyncSource(epoch: number): Promise<void> {
    if (epoch !== runtime.syncEpoch) return;
    const state = store.getState();
    if (!state.syncEnabled || !state.syncPath || (state.loadStatus !== "ready" && state.loadStatus !== "error")) return;
    if (runtime.pendingLocalWrites > 0 || runtime.syncWriteInFlight) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const path = state.syncPath;
    const baseline = runtime.syncBaseline && runtime.syncBaseline.path === path ? runtime.syncBaseline : null;
    // 首次读取失败（文件缺失/损坏）后仍继续轮询，外部修好文件即可自动载入。
    if (!baseline && state.syncStatus !== "error") return;
    const before = services.syncFingerprint(path, state.accounts, state.groups, state.trash);
    const source = await services.readSyncSource(path);
    if (epoch !== runtime.syncEpoch) return;
    // 读取窗口内本地又改过或正在写盘，交给写入路径按冲突处理，不能静默覆盖。
    if (runtime.pendingLocalWrites > 0 || runtime.syncWriteInFlight) return;
    const current = store.getState();
    if (services.syncFingerprint(path, current.accounts, current.groups, current.trash) !== before) return;
    if (services.isMissingFile(source.status)) {
      if (baseline) services.failSync("数据源文件已被移动或清空，写入已停止。", { syncNeedsCreate: true });
      return;
    }
    if (source.status !== "ok") return;
    if (baseline && isSameSyncContent(source.content, baseline.content)) {
      runtime.syncBaseline = { ...baseline, mtimeMs: source.mtimeMs, size: source.size };
      return;
    }
    services.applySourceSnapshot(path, source, { status: "success", error: null, notice: "已载入数据源文件的外部改动。" });
  }

  function startSyncWatch() {
    if (runtime.syncWatchTimer !== null || typeof window === "undefined") return;
    runtime.syncWatchTimer = setInterval(() => { void pollSyncSource(runtime.syncEpoch); }, SYNC_WATCH_INTERVAL);
  }

  function stopSyncWatch() {
    if (runtime.syncWatchTimer === null) return;
    clearInterval(runtime.syncWatchTimer);
    runtime.syncWatchTimer = null;
  }

  function watchVisibility() {
    if (runtime.visibilityWatched || typeof document === "undefined") return;
    runtime.visibilityWatched = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void pollSyncSource(runtime.syncEpoch);
    });
  }

  function scheduleSync() {
    const capturedQueue = runtime.persistQueue;
    const capturedRevision = runtime.localRevision;
    const epoch = runtime.syncEpoch;
    runtime.syncQueue = runtime.syncQueue.catch(() => undefined).then(async () => {
      await capturedQueue;
      if (capturedQueue !== runtime.persistQueue || capturedRevision !== runtime.localRevision) return;
      if (runtime.accountsPersistFailed || runtime.groupsPersistFailed) {
        const state = store.getState();
        if (epoch === runtime.syncEpoch && state.syncEnabled) {
          store.setState({ syncStatus: "error", syncError: "本地数据保存失败，自动同步已暂停。请检查存储权限后重试。" });
        }
        return;
      }
      await services.writeSyncSnapshot(epoch);
    });
  }

  return { pollSyncSource, startSyncWatch, stopSyncWatch, watchVisibility, scheduleSync };
}
