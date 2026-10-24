import { snapshotPreferences } from "./preferences";
import { exportAsSyncJson } from "@/lib/data-transfer";
import { isSameSyncContent, parseSyncLockInfo, syncLockPath } from "../../../shared/sync-protocol";
import type { StoreRuntime, StoreServices, StoreAccess } from "./store-types";

export function createSyncWriter(runtime: StoreRuntime, services: StoreServices, store: StoreAccess) {
  async function writeSyncSnapshot(epoch = runtime.syncEpoch): Promise<void> {
    const state = store.getState();
    if (epoch !== runtime.syncEpoch) return;
    if ((state.loadStatus !== "ready" && state.loadStatus !== "loading") || !state.syncEnabled || !state.syncPath) return;
    if (!runtime.platform.readSyncFile || !runtime.platform.writeSyncFile) return;
    const path = state.syncPath;
    const fingerprint = services.syncFingerprint(path, state.accounts, state.groups, state.trash);
    if (fingerprint === runtime.lastSyncFingerprint) {
      // 不覆盖冲突/错误提示：这两种状态必须由用户显式解除。
      if (state.syncStatus !== "conflict" && state.syncStatus !== "error") {
        store.setState({ syncStatus: "success", syncError: null });
      }
      return;
    }
    const approvingCreate = runtime.writeApproval?.path === path && runtime.writeApproval.mode === "create";
    const approvingOverwrite = runtime.writeApproval?.path === path && runtime.writeApproval.mode === "overwrite";
    // 冲突未处置前不写盘，避免用户在冲突提示下再改一笔就被当成「以本地为准」。
    if (state.syncStatus === "conflict" && !approvingOverwrite) return;
    store.setState({ syncStatus: "writing", syncError: null, syncLockHeld: null });
    const source = await services.readSyncSource(path);
    if (epoch !== runtime.syncEpoch) return;
    const current = store.getState();
    if (!current.syncEnabled || current.syncPath !== path) return;
    if (source.status === "unresolved") {
      services.failSync("数据源路径不是解析后的真实路径，已停止写入以免出现两把锁。");
      return;
    }
    if (source.status === "invalid" || source.status === "error") {
      services.failSync("数据源文件无法解析，已停止写入以免覆盖原文件。");
      return;
    }
    if (services.isMissingFile(source.status)) {
      if (!approvingCreate && !approvingOverwrite) {
        services.failSync("数据源文件不存在，已停止写入。", {
          syncNeedsCreate: true,
        });
        return;
      }
    } else if (!approvingOverwrite && source.status === "ok") {
      if (!runtime.syncBaseline || runtime.syncBaseline.path !== path) {
        store.setState({
          syncStatus: "conflict",
          syncError: "尚未读取过该数据源文件，已停止写入。",
          syncNotice: null,
        });
        return;
      }
      if (!isSameSyncContent(source.content, runtime.syncBaseline.content)) {
        services.applySourceSnapshot(path, source, {
          status: "conflict",
          error: "数据源文件已被其他程序修改，本次改动没有写入。已重新载入文件内容，请确认后重试。",
          notice: null,
        });
        return;
      }
    }
    const serialized = exportAsSyncJson(current.accounts, current.groups, current.trash, snapshotPreferences(current));
    // 基线内容交给写入端，在锁内逐字节复核：读→写之间外部改了文件就拒绝，而不是覆盖。
    // mtime/size 只是轮询的快速路径，不作为版本依据。
    const expectedContent = runtime.syncBaseline && runtime.syncBaseline.path === path && !approvingOverwrite
      ? runtime.syncBaseline.content
      : null;
    try {
      runtime.syncWriteInFlight = true;
      const result = await Promise.resolve(
        runtime.platform.writeSyncFile(path, serialized, syncLockPath(path), expectedContent, approvingCreate && services.isMissingFile(source.status)),
      );
      const after = store.getState();
      if (epoch !== runtime.syncEpoch || !after.syncEnabled || after.syncPath !== path) return;
      if (!result.ok) {
        if (result.reason === "conflict") {
          const fresh = await services.readSyncSource(path);
          if (epoch !== runtime.syncEpoch) return;
          if (fresh.status === "ok" && isSameSyncContent(fresh.content, serialized)) {
            // 另一个写入端写入了相同内容：等同本次写入成功。
            runtime.syncBaseline = { path, content: serialized, mtimeMs: fresh.mtimeMs, size: fresh.size };
            runtime.lastSyncFingerprint = fingerprint;
            runtime.writeApproval = null;
            store.setState({ syncStatus: "success", syncError: null, syncNotice: null, syncNeedsCreate: false });
            return;
          }
          if (fresh.status === "ok") {
            services.applySourceSnapshot(path, fresh, {
              status: "conflict",
              error: "数据源文件在写入前被其他程序修改，本次改动没有写入。已重新载入文件内容，请确认后重试。",
              notice: null,
            });
            return;
          }
          services.failSync("数据源文件在写入前消失或不可读，已停止写入。请确认路径后重试。");
          return;
        }
        if (result.reason === "unresolved") {
          services.failSync("数据源路径不是解析后的真实路径，已停止写入以免出现两把锁。");
          return;
        }
        if (result.reason === "locked") {
          const lock = parseSyncLockInfo(result.lockContent);
          store.setState({ syncLockHeld: lock });
          services.failSync(services.syncLockMessage(lock));
          return;
        }
        throw new Error(`sync write failed: ${result.reason}`);
      }
      runtime.lastSyncFingerprint = fingerprint;
      runtime.writeApproval = null;
      runtime.syncBaseline = { path, content: serialized, mtimeMs: result.mtimeMs, size: result.size };
      runtime.syncWriteVersion += 1;
      store.setState({
        syncStatus: "success",
        syncError: null,
        syncNotice: null,
        syncNeedsCreate: false,
        syncLockHeld: null,
      });
    } catch (error) {
      console.error("[goose-2fa] sync write failed:", error);
      const after = store.getState();
      if (epoch === runtime.syncEpoch && after.syncEnabled && after.syncPath === path) {
        services.failSync("自动同步失败，原有文件未被覆盖。请检查路径权限后重试。");
      }
    } finally {
      runtime.syncWriteInFlight = false;
    }
  }

  return { writeSyncSnapshot };
}
