/// <reference types="vite/client" />


interface ClipboardImageData {
  width: number;
  height: number;
  data: number[];
}

interface Goose2FA {
  loadAccounts: () => import("./lib/types").AccountData[];
  saveAccounts: (accounts: import("./lib/types").AccountData[]) => boolean;
  copyText: (text: string) => void;
  showNotification: (text: string) => void;
  readClipboardImage: () => ClipboardImageData | null;
  readClipboardText: () => string;
  captureScreen: (callback: (base64: string | null) => void) => boolean;
  hideWindow: () => void;
  showWindow: () => void;
  saveToFile?: (content: string, defaultName: string) => boolean;
  readFromFile?: () => string | null;
}

interface Window {
  goose2fa?: Goose2FA;
  utools?: Record<string, unknown>;
}
