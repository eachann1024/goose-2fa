import type { AccountData } from "@/lib/types";

export interface ClipboardImageData {
  width: number;
  height: number;
  data: number[];
}

export interface PlatformAdapter {
  loadAccounts(): AccountData[] | Promise<AccountData[]>;
  saveAccounts(accounts: AccountData[]): void | Promise<void>;
  copyText(text: string): void | Promise<void>;
  readClipboardText(): string | Promise<string>;
  readClipboardImage(): ClipboardImageData | null | Promise<ClipboardImageData | null>;
  captureScreen(): Promise<string | null>;
  saveToFile(content: string, defaultName: string): boolean | Promise<boolean>;
  readFromFile(): string | null | Promise<string | null>;
  hideWindow(): void;
  showWindow(): void;
  showNotification(text: string): void;
}
