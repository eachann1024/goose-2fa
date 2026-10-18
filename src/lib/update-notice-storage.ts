import { compareVersions, isStableVersion } from "./update-notices";

const CURSOR_KEY = "goose-2fa-notices-cursor-v1";
const LEGACY_READ_KEY = "goose-2fa-notices-read";

export interface NoticeCursor {
  installedVersion: string;
  readVersion: string;
  rangeStart: string;
}

export function readNoticeStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeNoticeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 私密模式或存储已满时，当前会话仍保留状态。
  }
}

export function loadNoticeCursor(currentVersion: string): NoticeCursor {
  const legacy = readNoticeStorage(LEGACY_READ_KEY);
  const baseline = isStableVersion(legacy) ? legacy : currentVersion;
  let cursor: NoticeCursor = {
    installedVersion: currentVersion, readVersion: baseline, rangeStart: baseline,
  };
  try {
    const saved = JSON.parse(readNoticeStorage(CURSOR_KEY) ?? "null");
    if (saved && isStableVersion(saved.installedVersion) && isStableVersion(saved.readVersion)
      && isStableVersion(saved.rangeStart) && compareVersions(saved.rangeStart, saved.readVersion) <= 0) {
      cursor = {
        installedVersion: compareVersions(currentVersion, saved.installedVersion) > 0
          ? currentVersion : saved.installedVersion,
        readVersion: saved.readVersion,
        rangeStart: saved.rangeStart,
      };
    }
  } catch {
    // 损坏的游标从当前安装版本重新建立，不将全部历史误判为未读。
  }
  saveNoticeCursor(cursor);
  return cursor;
}

export function saveNoticeCursor(cursor: NoticeCursor): void {
  writeNoticeStorage(CURSOR_KEY, JSON.stringify(cursor));
}

export function acknowledgeNotices(cursor: NoticeCursor, through: string, from: string): NoticeCursor {
  // 合并其他窗口的已读进度，回滚或旧窗口都不能倒退游标。
  const latest = loadNoticeCursor(cursor.installedVersion);
  if (compareVersions(through, latest.readVersion) <= 0) return latest;
  const next = { ...latest, readVersion: through, rangeStart: from };
  saveNoticeCursor(next);
  return next;
}
