import { version } from "../../package.json";
import {
  bucket,
  durationBucket,
  flush,
  initTelemetry,
  isTelemetryEnabled,
  setTelemetryEnabled,
  subscribeTelemetry,
  telemetryPreview,
  track,
  trackError,
  type TelemetryStorage,
} from "./telemetry";
import type { ViewMode } from "@/stores/accounts/store-types";

export type TelemetryModule =
  | "main"
  | "loading"
  | "quick"
  | "trash"
  | "transfer"
  | "add"
  | "detail"
  | "privacy"
  | "feedback";

export type AccountAddMethod = "scan" | "manual" | "import" | "uri";

export type ImportFormat =
  | "goose-2fa"
  | "2fas"
  | "aegis"
  | "andotp"
  | "raivo"
  | "freeotp"
  | "json"
  | "otpauth-migration"
  | "otpauth"
  | "secret"
  | "unknown";

export type ExportFormat = "json" | "uri";

const ENTRY_CODES = new Set(["2fa", "quick", "manage"]);
const bootAt = typeof performance !== "undefined" ? performance.now() : 0;

let initialized = false;
let currentModule: TelemetryModule = "main";
let sessionStartedAt: number | null = Date.now();
let openedCold = false;

function sanitizeEntry(code: unknown): string {
  return typeof code === "string" && ENTRY_CODES.has(code) ? code : "2fa";
}

function resolveStorage(): TelemetryStorage | undefined {
  if (typeof window === "undefined") return undefined;
  const db = (window as { utools?: { dbStorage?: Partial<TelemetryStorage> } }).utools?.dbStorage;
  if (
    db
    && typeof db.getItem === "function"
    && typeof db.setItem === "function"
    && typeof db.removeItem === "function"
  ) {
    return {
      getItem: (key) => db.getItem!(key),
      setItem: (key, value) => db.setItem!(key, value),
      removeItem: (key) => db.removeItem!(key),
    };
  }
  return undefined;
}

function flushSession() {
  if (sessionStartedAt === null) return;
  const elapsed = Math.max(0, Date.now() - sessionStartedAt);
  sessionStartedAt = null;
  track("app.session", { dur: durationBucket(elapsed) });
  void flush(true);
}

function trackOpen(entry: unknown) {
  const safeEntry = sanitizeEntry(entry);
  if (!openedCold) {
    openedCold = true;
    const coldMs = typeof performance !== "undefined" ? Math.max(0, Math.round(performance.now() - bootAt)) : 0;
    track("app.open", { entry: safeEntry, cold_ms: coldMs });
    return;
  }
  track("app.open", { entry: safeEntry });
}

export function setTelemetryModule(mod: TelemetryModule) {
  currentModule = mod;
}

export function resolveTelemetryModule(flags: {
  loadStatus: string;
  quickMode: boolean;
  showTrash: boolean;
  showDataTransfer: boolean;
  showAddForm: boolean;
  privacyOpen: boolean;
  feedbackOpen: boolean;
  hasDetail: boolean;
}): TelemetryModule {
  if (flags.loadStatus !== "ready") return "loading";
  if (flags.quickMode) return "quick";
  if (flags.showTrash) return "trash";
  if (flags.showDataTransfer) return "transfer";
  if (flags.showAddForm) return "add";
  if (flags.privacyOpen) return "privacy";
  if (flags.feedbackOpen) return "feedback";
  return flags.hasDetail ? "detail" : "main";
}

export function initAppTelemetry(theme: () => string) {
  if (initialized) return;
  initialized = true;
  sessionStartedAt = Date.now();

  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  if (typeof window !== "undefined") {
    // 必须在 initTelemetry 之前注册退出监听，确保 app.session 在 beacon flush 前入队。
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSession();
      else if (sessionStartedAt === null) sessionStartedAt = Date.now();
    });
    window.addEventListener("pagehide", flushSession);
    window.addEventListener("goose-2fa:plugin-out", flushSession);
    window.addEventListener("goose-2fa:plugin-enter", (event) => {
      if (fallbackTimer !== undefined) {
        clearTimeout(fallbackTimer);
        fallbackTimer = undefined;
      }
      sessionStartedAt = Date.now();
      const detail = (event as CustomEvent<{ code?: unknown }>).detail;
      trackOpen(detail?.code);
    });
  }

  const sysInfo = typeof window !== "undefined" ? window.goose2fa?.getSystemInfo?.() : undefined;
  initTelemetry({
    project: "2fa",
    version,
    storage: resolveStorage(),
    theme,
    ...(sysInfo?.osVersion ? { osVersion: () => sysInfo.osVersion } : {}),
    ...(sysInfo?.arch ? { arch: () => sysInfo.arch } : {}),
    module: () => currentModule,
  });

  if (typeof window !== "undefined") {
    if (!window.goose2fa) {
      trackOpen("2fa");
    } else {
      fallbackTimer = setTimeout(() => {
        fallbackTimer = undefined;
        if (!openedCold) trackOpen("2fa");
      }, 1000);
    }
  }
}

export function trackAccountCount(count: number) {
  track("account.count", { range: bucket(count) });
}

export function trackCodeCopy() {
  track("code.copy");
}

export function trackAccountAdd(method: AccountAddMethod) {
  track("account.add", { method });
}

export function trackAccountDelete() {
  track("account.delete");
}

export function trackImport(format: ImportFormat, count: number) {
  track("import", { format, range: bucket(count) });
}

export function trackExport(format: ExportFormat) {
  track("export", { format });
}

export function trackViewLayout(mode: ViewMode) {
  track("view.layout", { mode });
}

export function trackSync(ok: boolean) {
  track("sync", { ok });
}

export {
  bucket,
  isTelemetryEnabled,
  setTelemetryEnabled,
  subscribeTelemetry,
  telemetryPreview,
  trackError,
};
