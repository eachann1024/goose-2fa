import { useSyncExternalStore } from "react";

export const feedbackBase = "https://feedback-api.cooool.top";
const tokenKey = "goose:feedback:token";

export interface FeedbackMessage {
  id: string;
  role: "user" | "admin";
  message: string;
  at: string;
  files: { index: number; name: string; type: string; kind: "image" | "video" }[];
}
export interface FeedbackConversation {
  conversationId: string | null;
  messages: FeedbackMessage[];
  unreadCount: number;
}

const listeners = new Set<() => void>();
let unread = false;
let latestLoad = 0;

export function setFeedbackUnread(value: boolean) {
  unread = value;
  listeners.forEach((listener) => listener());
}

export function useFeedbackUnread() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unread,
    () => unread,
  );
}

function storageToken() {
  const db = (window as { utools?: { dbStorage?: { getItem?: (key: string) => unknown } } }).utools?.dbStorage;
  try {
    const fromDb = db?.getItem?.(tokenKey);
    if (typeof fromDb === "string" && fromDb) return fromDb;
  } catch { /* 本地存储不可用时改读另一处 */ }
  try {
    return window.localStorage.getItem(tokenKey) || "";
  } catch {
    return "";
  }
}

export function feedbackToken() {
  const existing = storageToken();
  if (existing) return existing;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const db = (window as { utools?: { dbStorage?: { setItem?: (key: string, value: string) => void } } }).utools?.dbStorage;
  try { db?.setItem?.(tokenKey, token); } catch { /* 写入失败仍尝试 localStorage */ }
  try { window.localStorage.setItem(tokenKey, token); } catch { /* 任一处读回成功即可 */ }
  const saved = storageToken();
  if (saved) return saved;
  throw new Error("无法保存反馈身份，请检查本地存储后重试");
}

export async function feedbackFetch(path: string, init: RequestInit = {}, timeout = 25000) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  init.signal?.addEventListener("abort", cancel, { once: true });
  if (init.signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, timeout);
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${feedbackToken()}`);
    const response = await fetch(`${feedbackBase}${path}`, { ...init, headers, signal: controller.signal });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `请求失败（${response.status}）`);
    }
    const blob = await response.blob();
    return new Response(blob, { status: response.status, headers: response.headers });
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}

export async function loadFeedback(project: string, signal?: AbortSignal): Promise<FeedbackConversation> {
  const request = ++latestLoad;
  const response = await feedbackFetch(`/api/conversation?project=${encodeURIComponent(project)}`, { signal });
  const data = (await response.json()) as FeedbackConversation;
  if (request === latestLoad) setFeedbackUnread(data.unreadCount > 0);
  return data;
}

let checking = false;
export async function checkFeedbackUnread(project: string) {
  if (checking || document.visibilityState === "hidden") return;
  checking = true;
  try {
    await loadFeedback(project);
  } catch { /* 离线时保留上一次未读状态 */ } finally {
    checking = false;
  }
}
