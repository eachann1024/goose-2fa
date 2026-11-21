/*
 * Anonymous telemetry (shared copy across goose-* uTools plugins; keep identical).
 *
 * Privacy contract:
 *  - identity = random 32-hex id created locally; deleted when the user turns telemetry off,
 *    regenerated on re-enable; never linked to the feedback token or uTools user;
 *  - props are short enum tokens only ([A-Za-z0-9_.:+-], ≤40 chars, no long hex ids);
 *    titles, text, paths, URLs, search words, secrets or names can't pass the filter;
 *  - counts must go through `bucket()`; numbers are allowed only for `*_ms` keys;
 *  - errors report only the error class name + a module token, never message or stack;
 *  - batched, best-effort: failed sends are dropped, nothing is persisted offline.
 * The server (feedback-api /api/telemetry) applies the same allow-list again.
 */

export type TelemetryValue = string | number | boolean
export type TelemetryProps = Record<string, TelemetryValue>

export interface TelemetryStorage {
  getItem(key: string): unknown
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface TelemetryOptions {
  project: "notes" | "2fa" | "mark" | "monitor"
  version: string
  storage?: TelemetryStorage
  theme?: () => string
  osVersion?: () => string
  arch?: () => string
  module?: () => string
  endpoint?: string
}

interface State { enabled: boolean; did: string | null }
interface QueuedEvent { name: string; props: TelemetryProps }

const KEY = "goose:telemetry:v1"
const TOKEN = /^[A-Za-z0-9_.:+-]{1,40}$/
const LONG_HEX = /[0-9a-f]{16,}/i
const EVENT = /^[a-z][a-z0-9_.]{1,47}$/
const PROP_KEY = /^[a-z][a-z0-9_]{0,31}$/
const FLUSH_MS = 60_000
const MAX_QUEUE = 200
const ERROR_REPEAT = 5

let opts: TelemetryOptions | null = null
let state: State = { enabled: true, did: null }
let queue: QueuedEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null
const errorSeen = new Map<string, number>()
const listeners = new Set<() => void>()

function store(): TelemetryStorage | null {
  if (opts?.storage) return opts.storage
  try { return typeof window !== "undefined" ? window.localStorage : null } catch { return null }
}

function randomId() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")
}

function load() {
  try {
    const raw = store()?.getItem(KEY)
    const data = typeof raw === "string" ? JSON.parse(raw) : raw
    if (data && typeof data === "object") {
      state = {
        enabled: data.enabled !== false,
        did: typeof data.did === "string" && /^[0-9a-f]{32}$/.test(data.did) ? data.did : null,
      }
    }
  } catch { /* corrupt → defaults */ }
  if (state.enabled && !state.did) state.did = randomId()
  save()
}

function save() {
  try { store()?.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function cleanToken(value: unknown) {
  const s = typeof value === "string" ? value.trim() : ""
  return TOKEN.test(s) && !LONG_HEX.test(s) ? s : ""
}

function cleanProps(props?: TelemetryProps): TelemetryProps {
  const out: TelemetryProps = {}
  if (!props) return out
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= 12 || !PROP_KEY.test(key)) continue
    if (typeof value === "boolean") out[key] = value
    else if (typeof value === "number") {
      if (key.endsWith("_ms") && Number.isFinite(value)) out[key] = Math.round(Math.max(0, value))
    } else {
      const t = cleanToken(value)
      if (t) out[key] = t
    }
  }
  return out
}

/** Coarse count bucket — always use this instead of sending a raw count. */
export function bucket(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0"
  if (n === 1) return "1"
  if (n <= 5) return "2-5"
  if (n <= 10) return "6-10"
  if (n <= 50) return "11-50"
  if (n <= 200) return "51-200"
  if (n <= 1000) return "201-1000"
  return "1000+"
}

/** Coarse duration bucket for session length. */
export function durationBucket(ms: number) {
  const m = ms / 60_000
  if (m < 1) return "lt1m"
  if (m < 5) return "1-5m"
  if (m < 30) return "5-30m"
  if (m < 120) return "30-120m"
  return "120m+"
}

function utoolsApi(): Record<string, (() => unknown) | undefined> | null {
  const u = (globalThis as { utools?: unknown }).utools
  return u && typeof u === "object" ? u as Record<string, () => unknown> : null
}

function envelope() {
  const u = utoolsApi()
  const call = (name: string) => { try { return u?.[name]?.() } catch { return undefined } }
  const os = call("isMacOS") ? "macos" : call("isWindows") ? "windows" : call("isLinux") ? "linux" : ""
  const lang = typeof navigator !== "undefined" ? String(navigator.language || "") : ""
  const [l, r] = lang.split("-")
  const safe = (fn?: () => string) => { try { return fn?.() || "" } catch { return "" } }
  return {
    ver: opts?.version || "",
    utools: String(call("getAppVersion") ?? "").split(".")[0],
    os,
    osVer: safe(opts?.osVersion).split(".")[0],
    arch: safe(opts?.arch),
    lang: l ? (r ? `${l.toLowerCase()}-${r.toUpperCase()}` : l.toLowerCase()) : "",
    theme: safe(opts?.theme),
  }
}

export function track(name: string, props?: TelemetryProps) {
  if (!opts || !state.enabled || !state.did || !EVENT.test(name)) return
  queue.push({ name, props: cleanProps(props) })
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
  if (queue.length >= 50) void flush()
  listeners.forEach(fn => fn())
}

export function trackError(error: unknown, module?: string) {
  const type = cleanToken((error as { name?: unknown })?.name) || "Error"
  const mod = cleanToken(module || (() => { try { return opts?.module?.() } catch { return "" } })()) || "unknown"
  const key = `${type}:${mod}`
  const n = (errorSeen.get(key) || 0) + 1
  errorSeen.set(key, n)
  if (n <= ERROR_REPEAT) track("error", { err_type: type, err_mod: mod })
}

export async function flush(useBeacon = false) {
  if (!opts || !state.enabled || !state.did || !queue.length) return
  const events = queue.splice(0, 50)
  const body = JSON.stringify({ v: 1, project: opts.project, did: state.did, app: envelope(), events })
  const url = opts.endpoint || "https://feedback-api.cooool.top/api/telemetry"
  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return
    await fetch(url, { method: "POST", body, headers: { "content-type": "text/plain" }, keepalive: true, credentials: "omit", referrerPolicy: "no-referrer" })
  } catch { /* best-effort: drop */ }
  listeners.forEach(fn => fn())
}

export function initTelemetry(options: TelemetryOptions) {
  if (opts) return
  opts = options
  load()
  if (typeof window === "undefined") return
  window.addEventListener("error", e => trackError(e.error ?? { name: "Error" }))
  window.addEventListener("unhandledrejection", e => trackError(e.reason ?? { name: "Rejection" }))
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(true) })
  window.addEventListener("pagehide", () => void flush(true))
  timer = setInterval(() => void flush(), FLUSH_MS)
}

export function isTelemetryEnabled() {
  return state.enabled
}

export function setTelemetryEnabled(enabled: boolean) {
  if (enabled === state.enabled) return
  if (enabled) state = { enabled: true, did: randomId() }
  else { state = { enabled: false, did: null }; queue = [] }
  save()
  listeners.forEach(fn => fn())
}

/** What would be sent right now — shown in the settings "查看上报内容" panel. */
export function telemetryPreview() {
  return {
    enabled: state.enabled,
    endpoint: opts?.endpoint || "https://feedback-api.cooool.top/api/telemetry",
    project: opts?.project || "",
    app: envelope(),
    pending: queue.map(e => ({ ...e, props: { ...e.props } })),
  }
}

export function subscribeTelemetry(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function stopTelemetry() {
  if (timer) clearInterval(timer)
  timer = null
}
