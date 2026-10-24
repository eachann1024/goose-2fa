import type { AccountData, VaultGroup } from "./types";

/** 一级「默认」筛选键（不是真实 VaultGroup.id） */
export const UNGROUPED_KEY = "__ungrouped__";
export const DEFAULT_GROUP_NAME = "默认";
export const MAX_GROUP_NAME_LENGTH = 20;

export function isUngrouped(account: AccountData): boolean {
  return !account.groupId;
}

export function filterByGroup(
  accounts: AccountData[],
  groupId: string | null,
): AccountData[] {
  if (groupId === null) return accounts;
  if (groupId === UNGROUPED_KEY) return accounts.filter(isUngrouped);
  return accounts.filter((a) => a.groupId === groupId);
}

export interface GroupTally {
  id: string;
  name: string;
  count: number;
  order: number;
}

/** 按 order 排列用户分组，并附带账户数。 */
export function buildGroupTallies(
  groups: VaultGroup[],
  accounts: AccountData[],
): GroupTally[] {
  const counts = new Map<string, number>();
  let ungrouped = 0;
  for (const account of accounts) {
    if (isUngrouped(account)) {
      ungrouped += 1;
      continue;
    }
    const id = account.groupId as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const sorted = [...groups].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh"),
  );

  const tallies: GroupTally[] = sorted.map((g) => ({
    id: g.id,
    name: g.name,
    count: counts.get(g.id) ?? 0,
    order: g.order,
  }));

  // 尚无自定义分组时不单独出现；建过分组后以「默认」承接没归属的账户
  if (sorted.length > 0) {
    tallies.push({
      id: UNGROUPED_KEY,
      name: DEFAULT_GROUP_NAME,
      count: ungrouped,
      order: Number.MAX_SAFE_INTEGER,
    });
  }

  return tallies;
}

/** 有分组时不再保留「全部」：优先第一个有账户的分组，否则第一个分组。 */
export function fallbackSelectedGroup(
  groups: VaultGroup[],
  accounts: AccountData[],
): string | null {
  if (groups.length === 0) return null;
  const tallies = buildGroupTallies(groups, accounts);
  return (tallies.find((group) => group.count > 0) ?? tallies[0])?.id ?? null;
}

/**
 * 解析一级选中态。
 * - 没有自定义分组时为 null，列表显示全部账户
 * - UNGROUPED_KEY 在已有分组时合法
 * - 真实 group id 必须仍存在；分组尚未 hydrate 且账户为空时保留原值
 */
export function resolveSelectedGroup(
  selected: string | null,
  groups: VaultGroup[],
  accounts: AccountData[],
): string | null {
  if (selected === UNGROUPED_KEY) return groups.length > 0 ? UNGROUPED_KEY : null;
  if (selected && groups.some((group) => group.id === selected)) return selected;
  if (groups.length === 0 && accounts.length === 0) return selected;
  if (groups.length === 0) return null;
  return fallbackSelectedGroup(groups, accounts);
}

export function nextGroupOrder(groups: VaultGroup[]): number {
  if (groups.length === 0) return 0;
  return Math.max(...groups.map((g) => g.order)) + 1;
}

export function normalizeGroupName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, MAX_GROUP_NAME_LENGTH);
}
