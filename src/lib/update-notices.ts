export interface UpdateNotice {
  id: string;
  version: string;
  date: string;
  items: string[];
}

export const MAX_CHANGELOG_SIZE = 512 * 1024;

export function isStableVersion(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
    && value.split(".").every((part) => Number.isSafeInteger(Number(part)));
}

export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = left[index]! - right[index]!;
    if (difference) return difference;
  }
  return 0;
}

function plainText(value: string): string {
  return value.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "").trim().slice(0, 2000);
}

/** 仅接受明确标注日期和稳定版本的二级标题，未发布/预发布段落不会混入。 */
export function parseUpdateNotices(markdown: string): UpdateNotice[] {
  if (markdown.length > MAX_CHANGELOG_SIZE) return [];
  const notices: UpdateNotice[] = [];
  let current: UpdateNotice | undefined;
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (/^##\s/.test(line)) {
      current = undefined;
      const match = /^## (\d{4}-\d{2}-\d{2}) · v(\d+\.\d+\.\d+)\s*$/.exec(line);
      if (!match || !isStableVersion(match[2])) continue;
      const date = match[1]!;
      const version = match[2]!;
      const timestamp = Date.parse(`${date}T00:00:00Z`);
      if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) continue;
      current = { id: version, version, date, items: [] };
      notices.push(current);
      continue;
    }
    if (!current || current.items.length >= 100) continue;
    const bullet = /^\s*(?:[-*•]|\d+\.)\s+(.+)$/.exec(line);
    if (bullet) {
      const item = plainText(bullet[1]!);
      if (item && !current.items.includes(item)) current.items.push(item);
    } else if (/^\s+\S/.test(line) && current.items.length) {
      const last = current.items.length - 1;
      current.items[last] = plainText(`${current.items[last]} ${line.trim()}`);
    }
  }
  return mergeUpdateNotices(notices.filter((notice) => notice.items.length));
}

/** 后面的来源覆盖同版本内容；较旧的镜像不会移除缓存里的较新记录。 */
export function mergeUpdateNotices(...sources: UpdateNotice[][]): UpdateNotice[] {
  const records = new Map<string, UpdateNotice>();
  for (const source of sources) {
    for (const notice of source) records.set(notice.version, notice);
  }
  return [...records.values()].sort((a, b) => compareVersions(b.version, a.version));
}

export function noticesAfter(notices: UpdateNotice[], version: string): UpdateNotice[] {
  return notices.filter((notice) => compareVersions(notice.version, version) > 0);
}
