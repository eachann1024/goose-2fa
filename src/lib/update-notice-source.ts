import bundledChangelog from "../../CHANGELOG.md?raw";
import { version as currentVersion } from "../../package.json";
import {
  compareVersions, isStableVersion, MAX_CHANGELOG_SIZE, mergeUpdateNotices, parseUpdateNotices, type UpdateNotice,
} from "./update-notices";
import { readNoticeStorage, writeNoticeStorage } from "./update-notice-storage";

const CACHE_KEY = "goose-2fa-notices-cache-v1";
const CACHE_TTL = 30 * 60 * 1000;
const RETRY_DELAY = 60 * 1000;
const SOURCE_PATH = "eachann1024/goose-2fa@main/public/update-notices.json";
// 同一份公开日志；不携带账号、密钥、设备标识或用户版本。
const SOURCES = [
  "https://raw.githubusercontent.com/eachann1024/goose-2fa/main/public/update-notices.json",
  `https://cdn.jsdelivr.net/gh/${SOURCE_PATH}`,
  `https://gcore.jsdelivr.net/gh/${SOURCE_PATH}`,
];

export interface NoticeFeed {
  notices: UpdateNotice[];
  checkedAt: number;
  status: "checking" | "fresh" | "cached" | "local";
}

export const BUNDLED_NOTICES = parseUpdateNotices(bundledChangelog)
  .filter((notice) => compareVersions(notice.version, currentVersion) <= 0);
let inFlight: Promise<NoticeFeed> | undefined;
let lastAttempt = 0;

export function loadCachedNoticeFeed(): NoticeFeed {
  try {
    const raw = readNoticeStorage(CACHE_KEY);
    if (raw && raw.length <= MAX_CHANGELOG_SIZE + 1024) {
      const cached = JSON.parse(raw);
      if (typeof cached.markdown === "string" && typeof cached.checkedAt === "number"
        && cached.checkedAt > 0 && cached.checkedAt <= Date.now()) {
        const notices = parseUpdateNotices(cached.markdown);
        if (notices.length) return {
          notices: mergeUpdateNotices(BUNDLED_NOTICES, notices),
          checkedAt: BUNDLED_NOTICES[0]
            && compareVersions(BUNDLED_NOTICES[0].version, notices[0]!.version) > 0 ? 0 : cached.checkedAt,
          status: "cached",
        };
      }
    }
  } catch {
    // 缓存不可信或不可用时，使用构建时打包的同一份日志。
  }
  return { notices: BUNDLED_NOTICES, checkedAt: 0, status: "local" };
}

async function fetchChangelog(url: string): Promise<{ version: string; notices: UpdateNotice[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
    });
    if (!response.ok || Number(response.headers.get("content-length")) > MAX_CHANGELOG_SIZE) {
      throw new Error("更新记录请求失败");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("更新记录为空");
    const decoder = new TextDecoder();
    let bytes = 0;
    let markdown = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_CHANGELOG_SIZE) throw new Error("更新记录过大");
        markdown += decoder.decode(value, { stream: true });
      }
      markdown += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const feed = JSON.parse(markdown);
    if (feed?.schema !== 1 || !isStableVersion(feed.version) || typeof feed.markdown !== "string") {
      throw new Error("更新记录格式无效");
    }
    const notices = parseUpdateNotices(feed.markdown)
      .filter((notice) => compareVersions(notice.version, feed.version) <= 0);
    if (compareVersions(feed.version, currentVersion) > 0
      && !notices.some((notice) => notice.version === feed.version)) {
      if (typeof feed.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(feed.date)
        || !Number.isFinite(Date.parse(`${feed.date}T00:00:00Z`))) {
        throw new Error("更新记录缺少发布日期");
      }
      notices.unshift({
        id: feed.version, version: feed.version, date: feed.date, items: ["此版本暂未提供更新日志。"],
      });
    }
    return { version: feed.version, notices };
  } finally {
    clearTimeout(timer);
  }
}

function serializeNotices(notices: UpdateNotice[]): string {
  return notices.map((notice) => `## ${notice.date} · v${notice.version}\n\n${
    notice.items.map((item) => `- ${item}`).join("\n")
  }`).join("\n\n");
}

export function refreshNoticeFeed(force = false): Promise<NoticeFeed> {
  if (inFlight) return inFlight;
  const cached = loadCachedNoticeFeed();
  const now = Date.now();
  if (!force && cached.checkedAt && now - cached.checkedAt < CACHE_TTL) return Promise.resolve(cached);
  if (!force && now - lastAttempt < RETRY_DELAY) return Promise.resolve(cached);
  lastAttempt = now;
  inFlight = (async () => {
    const results = await Promise.allSettled(SOURCES.map(fetchChangelog));
    const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (!available.length) return { ...cached, status: "local" } satisfies NoticeFeed;
    // GitHub 直连优先；等所有有界请求完成，避免最快的旧镜像掩盖新版本。
    const ordered = available.reverse().sort((a, b) => compareVersions(a.version, b.version));
    const remote = mergeUpdateNotices(...ordered.map((feed) => feed.notices));
    const notices = mergeUpdateNotices(cached.notices, remote);
    // 内置日志来自当前安装包；线上发布清单落后不代表请求失败。
    const checkedAt = Date.now();
    const markdown = serializeNotices(notices);
    if (markdown.length <= MAX_CHANGELOG_SIZE) {
      writeNoticeStorage(CACHE_KEY, JSON.stringify({ markdown, checkedAt }));
    }
    return { notices, checkedAt, status: "fresh" } satisfies NoticeFeed;
  })().finally(() => { inFlight = undefined; });
  return inFlight;
}
