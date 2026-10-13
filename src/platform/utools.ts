import type { AccountData, VaultGroup } from "@/lib/types";
import type { PlatformAdapter, SubInputHandler, SyncFileRead, SyncFileWrite } from "./types";

/** uTools 适配器，委托 window.goose2fa */
export function createUToolsAdapter(): PlatformAdapter {
  const api = window.goose2fa!;

  return {
    loadAccounts(): AccountData[] {
      const accounts = api.loadAccounts();
      if (!Array.isArray(accounts)) throw new Error("账户读取失败");
      return accounts;
    },

    saveAccounts(accounts: AccountData[]): void {
      if (api.saveAccounts(accounts) !== true) throw new Error("账户保存失败");
    },

    loadGroups(): VaultGroup[] {
      const groups = api.loadGroups?.() ?? [];
      if (!Array.isArray(groups)) throw new Error("分组读取失败");
      return groups;
    },

    saveGroups(groups: VaultGroup[]): void {
      if (api.saveGroups?.(groups) !== true) throw new Error("分组保存失败");
    },

    copyText(text: string): void {
      api.copyText(text);
    },

    readClipboardText(): string {
      return api.readClipboardText();
    },

    readClipboardImage() {
      return api.readClipboardImage();
    },

    captureScreen(): Promise<string | null> {
      return new Promise((resolve) => {
        const ok = api.captureScreen((base64) => {
          resolve(base64 ?? null);
        });
        if (!ok) resolve(null);
      });
    },

    saveToFile(content: string, defaultName: string): boolean {
      return api.saveToFile?.(content, defaultName) ?? false;
    },

    readFromFile(): string | null {
      return api.readFromFile?.() ?? null;
    },

    supportsFileSync: typeof api.readSyncFile === "function" && typeof api.writeSyncFile === "function",

    getDefaultSyncPath(): string {
      return api.getDefaultSyncPath?.() ?? "";
    },

    selectSyncPath(mode): string | null {
      return api.selectSyncPath?.(mode) ?? null;
    },

    resolveSyncPath(path: string): string {
      try {
        return api.resolveSyncPath?.(path) ?? path;
      } catch {
        return path;
      }
    },

    clearSyncLock(lockPath: string): boolean {
      try {
        return api.clearSyncLock?.(lockPath) === true;
      } catch {
        return false;
      }
    },

    readSyncFile(path: string): SyncFileRead {
      try {
        return api.readSyncFile?.(path) ?? { ok: false, reason: "unreadable" };
      } catch {
        return { ok: false, reason: "unreadable" };
      }
    },

    writeSyncFile(
      path: string,
      content: string,
      lockPath: string,
      expectedContent: string | null,
      createOnly?: boolean,
    ): SyncFileWrite {
      try {
        return api.writeSyncFile?.(path, content, lockPath, expectedContent, createOnly) ?? { ok: false, reason: "io" };
      } catch {
        return { ok: false, reason: "io" };
      }
    },

    hideWindow(): void {
      api.hideWindow();
    },

    showWindow(): void {
      api.showWindow();
    },

    showNotification(text: string): void {
      api.showNotification(text);
    },

    setSubInput(handler: SubInputHandler, placeholder: string, initial?: string): void {
      api.setSubInput?.(handler, placeholder, initial);
    },

    removeSubInput(): void {
      api.removeSubInput?.();
    },

    pasteText(text: string): boolean {
      return api.pasteText?.(text) ?? false;
    },

    typeString(text: string): boolean {
      return api.typeString?.(text) ?? false;
    },

    outPlugin(): void {
      api.outPlugin?.();
    },
  };
}
