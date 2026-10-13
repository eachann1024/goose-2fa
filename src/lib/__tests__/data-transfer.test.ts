import { describe, expect, it } from "vitest";
import { deduplicateImports, exportAsJson, exportAsSyncJson, parseImportBundle, parseSyncSnapshot } from "../data-transfer";
import type { AccountData, NewAccountInput, VaultGroup } from "../types";

const input: NewAccountInput = {
  name: "alice@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  counter: 0,
  algorithm: "SHA-1",
  note: "工作账号",
  remark: "主账号",
  originalName: "GitHub (alice@example.com)",
  groupId: "work",
};

const account: AccountData = { ...input, id: "account-1", createdAt: 1 };
const groups: VaultGroup[] = [{ id: "work", name: "工作", order: 0, createdAt: 1 }];

describe("goose-2fa 备份", () => {
  it("完整恢复分组、备注和账户归属，并剔除设备元数据", () => {
    const exported = exportAsJson([{ ...account, meta: { location: { latitude: 1, longitude: 2 } } }], groups);
    expect(exported).not.toContain("latitude");
    const parsed = parseImportBundle(exported);
    expect(parsed?.groups).toEqual(groups);
    expect(parsed?.accounts).toEqual([input]);
  });

  it("兼容 v1 备份", () => {
    const parsed = parseImportBundle(JSON.stringify({ app: "goose-2fa", version: 1, accounts: [input] }));
    expect(parsed?.accounts).toEqual([input]);
    expect(parsed?.groups).toEqual([]);
  });
});

describe("数据源快照", () => {
  it("保留账户 id、创建时间、回收站与备注", () => {
    const trashed: AccountData = { ...account, id: "account-2", deletedAt: 123 };
    const snapshot = parseSyncSnapshot(exportAsSyncJson([account], groups, [trashed]));
    expect(snapshot?.accounts).toEqual([{ ...account, groupId: "work" }]);
    expect(snapshot?.groups).toEqual(groups);
    expect(snapshot?.trash).toEqual([{ ...trashed, groupId: "work" }]);
  });

  it("保留用户偏好并拒绝非法设置，不同步文件内部的绝对路径", () => {
    const preferences = { viewMode: "list" as const, selectedGroup: "work", accentColor: "pine" as const, isDark: true, isThemeLocked: true };
    const raw = JSON.parse(exportAsSyncJson([account], groups, [], preferences));
    raw.preferences.syncPath = "/another-user/Documents/source.json";
    expect(parseSyncSnapshot(JSON.stringify(raw))?.preferences).toEqual(preferences);
    raw.preferences.viewMode = "invalid";
    expect(parseSyncSnapshot(JSON.stringify(raw))).toBeNull();
  });

  it("拒绝缺少稳定 id 的手动导出，避免被当成数据源", () => {
    expect(parseSyncSnapshot(exportAsJson([account], groups))).toBeNull();
  });

  it("拒绝损坏内容与残缺条目，不把无法解析的输入当成空库", () => {
    expect(parseSyncSnapshot("{ 不是 JSON")).toBeNull();
    expect(parseSyncSnapshot(JSON.stringify({ app: "other", accounts: [] }))).toBeNull();
    expect(parseSyncSnapshot(JSON.stringify({ app: "goose-2fa", accounts: [{ ...account, secret: "ABC" }] }))).toBeNull();
    expect(parseSyncSnapshot(JSON.stringify({ app: "goose-2fa", accounts: [], trash: [{}] }))).toBeNull();
  });

  it("拒绝重复 id，避免一次编辑命中多条账户", () => {
    const trashed: AccountData = { ...account, id: "account-2", deletedAt: 123 };
    expect(parseSyncSnapshot(exportAsSyncJson([{ ...account }, { ...account }], groups, [trashed]))).toBeNull();
    expect(parseSyncSnapshot(exportAsSyncJson([account], groups, [{ ...trashed, id: account.id }]))).toBeNull();
  });

  it("接受合法的空库", () => {
    expect(parseSyncSnapshot(JSON.stringify({ app: "goose-2fa", version: 2, accounts: [], groups: [], trash: [] })))
      .toEqual({ accounts: [], groups: [], trash: [] });
  });
});

describe("导入去重", () => {
  it("同时去除已有重复和同一批内部重复", () => {
    const other = { ...input, name: "bob@example.com" };
    const result = deduplicateImports([input, input, other, other], [account]);
    expect(result.dupeCount).toBe(3);
    expect(result.newAccounts).toEqual([other]);
  });

  it("不会把同密钥但不同类型或账号名误判为重复", () => {
    const hotp = { ...input, type: "hotp" as const, counter: 2 };
    const renamed = { ...input, name: "bob@example.com" };
    expect(deduplicateImports([hotp, renamed], [account]).newAccounts).toEqual([hotp, renamed]);
  });
});
