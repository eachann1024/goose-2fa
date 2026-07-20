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

  it("可把账户移动到其他分组或未分组，重复投放不会保存", async () => {
    const saveAccounts = vi.fn();
    initPlatform(makeAdapter(saveAccounts));
    useAccounts.setState({
      groups: [{ id: "work", name: "工作", order: 0, createdAt: 1 }],
      accounts: [{
        ...input,
        id: "account-1",
        createdAt: 1,
        groupId: null,
      }],
    });

    useAccounts.getState().updateAccountGroup("account-1", "work");
    expect(useAccounts.getState().accounts[0]?.groupId).toBe("work");

    await vi.waitFor(() => expect(saveAccounts).toHaveBeenCalledTimes(1));
    useAccounts.getState().updateAccountGroup("account-1", "work");
    expect(saveAccounts).toHaveBeenCalledTimes(1);

    useAccounts.getState().updateAccountGroup("account-1", null);
    expect(useAccounts.getState().accounts[0]?.groupId).toBeNull();
    await vi.waitFor(() => expect(saveAccounts).toHaveBeenCalledTimes(2));
  });

  it("拒绝未知分组，避免把账户误移到未分组", () => {
    const saveAccounts = vi.fn();
    initPlatform(makeAdapter(saveAccounts));
    useAccounts.setState({
      accounts: [{
        ...input,
        id: "account-1",
        createdAt: 1,
        groupId: "work",
      }],
      groups: [{ id: "work", name: "工作", order: 0, createdAt: 1 }],
    });

    useAccounts.getState().updateAccountGroup("account-1", "missing");

    expect(useAccounts.getState().accounts[0]?.groupId).toBe("work");
    expect(saveAccounts).not.toHaveBeenCalled();
  });
});
