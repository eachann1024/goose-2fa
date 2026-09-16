import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeCell } from "../CodeCell";
import type { AccountData } from "@/lib/types";

const mockAccount: AccountData = {
  id: "acc-1",
  name: "old@example.com",
  issuer: "GitHub",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  counter: 0,
  algorithm: "SHA-1",
  createdAt: 1,
  originalName: "GitHub (old@example.com)",
  note: "GitHub (new@example.com)",
};

describe("CodeCell 账户名展示", () => {
  it("修改名称后优先显示 note", () => {
    render(
      <CodeCell
        account={mockAccount}
        onCopy={vi.fn()}
        onDetail={vi.fn()}
        onIncrement={vi.fn()}
        index={0}
        viewMode="compact"
        sortable={false}
      />
    );

    expect(screen.getByText("GitHub (new@example.com)")).toBeInTheDocument();
    expect(screen.queryByText("GitHub (old@example.com)")).not.toBeInTheDocument();
  });
});
