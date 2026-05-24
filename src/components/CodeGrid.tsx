import { useCallback } from "react";
import { CodeCell } from "./CodeCell";
import { EmptyState } from "./EmptyState";
import { usePlatform } from "@/platform/context";
import type { AccountData } from "@/lib/types";

interface CodeGridProps {
  accounts: AccountData[];
  searchQuery: string;
  onCopy: (text: string) => void;
  onDetail: (account: AccountData) => void;
  onIncrement: (id: string) => void;
  onAdd: () => void;
  onClipboardImport: () => void;
  onScreenCapture: () => void;
}

export function CodeGrid({
  accounts,
  searchQuery,
  onCopy,
  onDetail,
  onIncrement,
  onAdd,
  onClipboardImport,
  onScreenCapture,
}: CodeGridProps) {
  const platform = usePlatform();

  const filtered = accounts.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.issuer.toLowerCase().includes(q)
    );
  });

  const handleCopy = useCallback(
    (text: string) => {
      platform.copyText(text);
      onCopy(text);
    },
    [onCopy, platform],
  );

  if (accounts.length === 0) {
    return <EmptyState onAdd={onAdd} onClipboardImport={onClipboardImport} onScreenCapture={onScreenCapture} />;
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-[13px] text-fg-faint">
          未找到匹配 "{searchQuery}" 的账户
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-4">
      {filtered.map((account, i) => (
        <CodeCell
          key={account.id}
          account={account}
          onCopy={handleCopy}
          onDetail={onDetail}
          onIncrement={onIncrement}
          index={i}
        />
      ))}
    </div>
  );
}
