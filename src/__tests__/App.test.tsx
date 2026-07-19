import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { PlatformProvider } from "@/platform/context";
import type { PlatformAdapter } from "@/platform/types";
import { initPlatform, useAccounts } from "@/stores/useAccounts";
import type { AccountData } from "@/lib/types";

const account: AccountData = {
  id: "account-1",
  name: "alice@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  counter: 0,
  algorithm: "SHA-1",
  createdAt: 1,
  groupId: null,
};

function makeAdapter(loadAccounts: PlatformAdapter["loadAccounts"]): PlatformAdapter {
  return {
    loadAccounts,
    saveAccounts: vi.fn(),
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

function renderApp(adapter: PlatformAdapter) {
  initPlatform(adapter);
  return render(
    <PlatformProvider adapter={adapter}>
      <App />
    </PlatformProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  useAccounts.setState({
    accounts: [],
    trash: [],
    groups: [],
    searchQuery: "",
    showAddForm: false,
    showDataTransfer: false,
    showTrash: false,
    isDark: false,
    isThemeLocked: false,
    editMode: false,
    viewMode: "compact",
    selectedGroup: null,
    ambientEnabled: true,
    loadStatus: "idle",
    loadError: null,
  });
});

describe("App 核心流程", () => {
  it("数据完成读取前保持门禁，读取后可进入账户详情", async () => {
    let resolveLoad!: (accounts: AccountData[]) => void;
    const pending = new Promise<AccountData[]>((resolve) => {
      resolveLoad = resolve;
    });
    renderApp(makeAdapter(() => pending));

    expect(screen.getByText("正在读取本地账户")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "验证码" })).not.toBeInTheDocument();

    await act(async () => resolveLoad([account]));
    expect(await screen.findByRole("heading", { name: "验证码" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(await screen.findByRole("button", { name: "返回" })).toBeInTheDocument();
    expect(screen.getByText("账户详情")).toBeInTheDocument();
    expect(screen.getAllByText(/alice@example\.com/)).toHaveLength(2);
  });

  it("读取失败不会进入空仓库，重试后恢复", async () => {
    const loadAccounts = vi
      .fn<PlatformAdapter["loadAccounts"]>()
      .mockRejectedValueOnce(new Error("broken storage"))
      .mockResolvedValueOnce([]);
    renderApp(makeAdapter(loadAccounts));

    expect(await screen.findByRole("alert")).toHaveTextContent("已有数据不会被覆盖");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByRole("heading", { name: "验证码" })).toBeInTheDocument();
    expect(loadAccounts).toHaveBeenCalledTimes(2);
  });

  it("添加账户入口可到达且表单字段有可访问名称", async () => {
    renderApp(makeAdapter(() => []));
    await screen.findByRole("heading", { name: "验证码" });

    fireEvent.click(screen.getByRole("button", { name: "添加账户" }));
    expect(await screen.findByRole("heading", { name: "添加账户" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "账户名称" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "密钥" })).toBeInTheDocument();
  });
});
