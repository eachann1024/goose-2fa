import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewAccountInput } from "@/lib/types";
import type { PlatformAdapter } from "@/platform/types";
import { initPlatform, useAccounts } from "../useAccounts";

const input: NewAccountInput = {
  name: "alice@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  counter: 0,
  algorithm: "SHA-1",
};

function makeAdapter(saveAccounts: PlatformAdapter["saveAccounts"] = vi.fn()): PlatformAdapter {
  return {
    loadAccounts: vi.fn(() => []),
    saveAccounts,
    copyText: vi.fn(),
    readClipboardText: vi.fn(() => ""),
    readClipboardImage: vi.fn(() => null),
    captureScreen: vi.fn(async () => null),
    saveToFile: vi.fn(() => true),
    readFromFile: vi.fn(() => null),
    hideWindow: vi.fn(),
    showWindow: vi.fn(),
    showNotification: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
  useAccounts.setState({
    accounts: [],
    trash: [],
    groups: [],
    selectedGroup: null,
    showAddForm: false,
    loadStatus: "ready",
    loadError: null,
  });
});

describe("账户存储", () => {
  it("串行保存连续变更，最后一次快照包含全部账户", async () => {
    const snapshots: string[][] = [];
    const adapter = makeAdapter(async (accounts) => {
      snapshots.push(accounts.map((account) => account.name));
    });
    initPlatform(adapter);

    useAccounts.getState().addAccount(input);
    useAccounts.getState().addAccount({ ...input, name: "bob@example.com" });

    await vi.waitFor(() => expect(snapshots).toHaveLength(2));
    expect(snapshots).toEqual([
      ["alice@example.com"],
      ["alice@example.com", "bob@example.com"],
    ]);
  });

  it("导入分组 ID 冲突但名称不同时创建新分组", () => {
    initPlatform(makeAdapter());
    useAccounts.setState({
      groups: [{ id: "shared-id", name: "现有分组", order: 0, createdAt: 1 }],
    });

    useAccounts.getState().importAccounts(
      [{ ...input, groupId: "shared-id" }],
      [{ id: "shared-id", name: "备份分组", order: 0, createdAt: 2 }],
    );

    const state = useAccounts.getState();
    expect(state.groups.map((group) => group.name)).toEqual(["现有分组", "备份分组"]);
    expect(state.accounts[0]?.groupId).not.toBe("shared-id");
    expect(state.groups.some((group) => group.id === state.accounts[0]?.groupId)).toBe(true);
  });

  it("保存失败时向用户发出通知", async () => {
    const adapter = makeAdapter(vi.fn(async () => {
      throw new Error("disk full");
    }));
    initPlatform(adapter);

    useAccounts.getState().addAccount(input);

    await vi.waitFor(() => {
      expect(adapter.showNotification).toHaveBeenCalledWith("账户保存失败，请检查存储权限后重试");
    });
  });
});
