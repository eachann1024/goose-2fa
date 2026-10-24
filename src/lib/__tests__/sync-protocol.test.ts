import { describe, expect, it } from "vitest";
import {
  isSameSyncStat,
  normalizeSyncPath,
  parseSyncLockInfo,
  syncLockPath,
} from "../../../shared/sync-protocol";

describe("跨端数据源协议", () => {
  it("路径规范化展开 ~、折叠重复斜杠并解析 . 与 ..", () => {
    expect(normalizeSyncPath("  /Users/me/vault/../vault/sync.json ")).toBe("/Users/me/vault/sync.json");
    expect(normalizeSyncPath("~/Library/sync.json", "/Users/me")).toBe("/Users/me/Library/sync.json");
    expect(normalizeSyncPath("~", "/Users/me/")).toBe("/Users/me");
    expect(normalizeSyncPath("//a//b/./c/")).toBe("/a/b/c");
    expect(normalizeSyncPath("")).toBe("");
  });

  it("锁名对同一文件始终稳定，两端不会各写一把锁", () => {
    expect(syncLockPath("/tmp/sync.json")).toBe("/tmp/sync.json.lock");
    expect(syncLockPath("/tmp/./sync.json")).toBe("/tmp/sync.json.lock");
  });

  it("内容比较与 stat 快速路径遵循同一规则", () => {
    expect(isSameSyncStat({ mtimeMs: 1, size: 2 }, { mtimeMs: 1, size: 2 })).toBe(true);
    expect(isSameSyncStat({ mtimeMs: 1, size: 2 }, { mtimeMs: 1, size: 3 })).toBe(false);
  });

  it("锁信息只解析出持有者，协议不提供任何按时间抢锁的判定", () => {
    expect(parseSyncLockInfo("1234\n1700000000000\n")).toEqual({ pid: 1234, createdAt: 1700000000000 });
    expect(parseSyncLockInfo("1234\n")).toEqual({ pid: 1234, createdAt: null });
    expect(parseSyncLockInfo("")).toEqual({ pid: null, createdAt: null });
    expect(parseSyncLockInfo(null)).toEqual({ pid: null, createdAt: null });
  });
});
