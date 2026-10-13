import type { AccountData, VaultGroup } from "@/lib/types";

export interface ClipboardImageData {
  width: number;
  height: number;
  data: number[];
}

/**
 * 读取自动同步数据源文件的结果；失败原因必须显式区分，不能把「读不到」当作「空文件」。
 * unresolved = 传入的不是解析后的真实路径，拒绝读写，避免别名路径产生第二把锁。
 */
export type SyncFileRead =
  | { ok: true; content: string; mtimeMs: number; size: number }
  | { ok: false; reason: "missing" | "unreadable" | "too-large" | "unresolved" };

/**
 * 写入数据源文件的结果。
 * conflict = 锁内逐字节比对发现外部已改；locked = 另一个写入端正在写（附锁文件原始内容供用户判断）。
 */
export type SyncFileWrite =
  | { ok: true; mtimeMs: number; size: number }
  | { ok: false; reason: "locked" | "conflict" | "invalid" | "io" | "unresolved"; lockContent?: string | null };

/** uTools 子搜索框输入回调；其他端可忽略。 */
export type SubInputHandler = (text: string) => void;

/** onPluginEnter 派发到 window 上的事件 payload。 */
export interface PluginEnterDetail {
  code: string;
  /** uTools 类型：text / img / files / regex / over / window 等，其他端为 "main" */
  type?: string;
  /** regex 模式下为用户输入的字符串，例如 "github"；主关键字模式下为 cmd 字符串。 */
  payload?: string;
}

export interface PlatformAdapter {
  loadAccounts(): AccountData[] | Promise<AccountData[]>;
  saveAccounts(accounts: AccountData[]): void | Promise<void>;
  loadGroups(): VaultGroup[] | Promise<VaultGroup[]>;
  saveGroups(groups: VaultGroup[]): void | Promise<void>;
  copyText(text: string): void | Promise<void>;
  readClipboardText(): string | Promise<string>;
  readClipboardImage(): ClipboardImageData | null | Promise<ClipboardImageData | null>;
  captureScreen(): Promise<string | null>;
  saveToFile(content: string, defaultName: string): boolean | Promise<boolean>;
  readFromFile(): string | null | Promise<string | null>;
  /** 自动同步数据源：读+写都具备时才算支持，只有 uTools 原生文件适配器满足。 */
  supportsFileSync?: boolean;
  /** 用户文档目录下的默认 JSON 文件路径。 */
  getDefaultSyncPath?(): string;
  selectSyncPath?(mode?: "existing" | "new"): string | null | Promise<string | null>;
  /** 把路径解析到真实文件/真实父目录；同一文件的不同别名必须落到同一把锁。 */
  resolveSyncPath?(path: string): string;
  /** 用户显式清理残留锁文件；锁从不按时间自动清理。 */
  clearSyncLock?(lockPath: string): boolean;
  /** 无对话框静默读取指定路径，用于启动加载、外部改动轮询与写前校验。 */
  readSyncFile?(path: string): SyncFileRead | Promise<SyncFileRead>;
  /**
   * 原子写入数据源文件。lockPath 由 shared/sync-protocol.ts 的 syncLockPath 统一生成，
   * expectedContent 由写入端在锁内逐字节比对（mtime/size 不作版本依据），不一致时返回 conflict。
   */
  writeSyncFile?(
    path: string,
    content: string,
    lockPath: string,
    expectedContent: string | null,
    createOnly?: boolean,
  ): SyncFileWrite | Promise<SyncFileWrite>;
  hideWindow(): void;
  showWindow(): void;
  showNotification(text: string): void;

  /** uTools 专属：接管/释放主搜索框作为子输入框。其他端为 noop。 */
  setSubInput?(handler: SubInputHandler, placeholder: string, initial?: string): void;
  removeSubInput?(): void;
  /** uTools 专属：隐藏主窗口并把 text 粘贴到上一个聚焦窗口。返回是否调用成功。 */
  pasteText?(text: string): boolean;
  /** uTools 专属：隐藏主窗口并模拟键盘输入 text（兜底，部分网站拒绝粘贴时用）。 */
  typeString?(text: string): boolean;
  /** uTools 专属：退出插件，回到 uTools 主搜索框。 */
  outPlugin?(): void;
}
