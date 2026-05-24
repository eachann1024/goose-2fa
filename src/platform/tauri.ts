import type { AccountData } from "@/lib/types";
import type { PlatformAdapter } from "./types";

/** Tauri v2 适配器，使用 Tauri JS API */
export function createTauriAdapter(): PlatformAdapter {
  // 动态导入由调用方完成，此处各方法再按需延迟导入
  return {
    async loadAccounts(): Promise<AccountData[]> {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<AccountData[]>("load_accounts");
    },

    async saveAccounts(accounts: AccountData[]): Promise<void> {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_accounts", { accounts });
    },

    async copyText(text: string): Promise<void> {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
    },

    async readClipboardText(): Promise<string> {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      const text = await readText();
      return text ?? "";
    },

    async readClipboardImage() {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<import("./types").ClipboardImageData | null>("read_clipboard_image");
    },

    async captureScreen(): Promise<string | null> {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string | null>("capture_screen");
    },

    async saveToFile(content: string, defaultName: string): Promise<boolean> {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await save({ defaultPath: defaultName, filters: [{ name: "JSON", extensions: ["json"] }] });
      if (!path) return false;
      await invoke("write_file", { path, content });
      return true;
    },

    async readFromFile(): Promise<string | null> {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await open({ filters: [{ name: "JSON", extensions: ["json", "txt"] }] });
      if (!path) return null;
      const filePath = typeof path === "string" ? path : path[0];
      if (!filePath) return null;
      return invoke<string>("read_file", { path: filePath });
    },

    async hideWindow(): Promise<void> {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    },

    async showWindow(): Promise<void> {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().show();
    },

    async showNotification(text: string): Promise<void> {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      sendNotification(text);
    },
  };
}
