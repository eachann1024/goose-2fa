import { useState, useCallback, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOtpCode } from "@/hooks/useOtpCode";
import type { AccountData } from "@/lib/types";
import type { ViewMode } from "@/stores/useAccounts";

import { CellBody } from "./CellBody";
import { CellShell } from "./CellShell";
import { AccountContextMenu } from "./AccountContextMenu";

interface CodeCellProps {
  account: AccountData;
  onCopy: (text: string) => boolean | Promise<boolean>;
  onDetail: (account: AccountData) => void;
  onIncrement: (id: string) => void;
  index: number;
  viewMode: ViewMode;
  sortable: boolean;
}

export function CodeCell({
  account,
  onCopy,
  onDetail,
  onIncrement,
  index: _index,
  viewMode,
  sortable,
}: CodeCellProps) {
  const { code, remaining, period } = useOtpCode(account);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({
    id: `account:${account.id}`,
    disabled: !sortable,
    data: { type: "account", accountId: account.id },
    transition: {
      duration: 180,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    },
  });

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopy = useCallback(async () => {
    setCopyError(false);
    const success = await onCopy(code);
    if (!success) {
      setCopyError(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopyError(false), 1800);
      return;
    }
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1200);
  }, [code, onCopy]);

  const handleDetailClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDetail(account);
    },
    [account, onDetail],
  );

  const handleRefresh = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onIncrement(account.id);
    },
    [account.id, onIncrement],
  );

  // 拖动源：拖起后留在原位作半透明"空位"，真正跟手的视觉由 DragOverlay 接管。
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.4 } : {}),
  };

  return (
    <AccountContextMenu account={account} disabled={isDragging} onCopy={handleCopy} onDetail={onDetail}>
      <CellShell
        ref={setNodeRef}
        style={style}
        viewMode={viewMode}
        copied={copied}
        className={isDragging ? "dragging-source" : isSorting ? "dragging-sibling" : ""}
        onClick={() => void handleCopy()}
        copyLabel={`复制 ${account.note || account.issuer || account.name} 的验证码`}
        interactive
        activatorRef={setActivatorNodeRef}
        activatorProps={sortable ? { ...attributes, ...listeners } : undefined}
      >
        <CellBody
          account={account}
          code={code}
          remaining={remaining}
          period={period}
          copied={copied}
          copyError={copyError}
          viewMode={viewMode}
          onDetailClick={handleDetailClick}
          onRefresh={handleRefresh}
        />
      </CellShell>
    </AccountContextMenu>
  );
}

/* ---------- 拖动浮层：跟手 + 放大 + 阴影 ---------- */

interface CodeCellOverlayProps {
  account: AccountData;
  viewMode: ViewMode;
}

/** DragOverlay 内渲染的卡片副本：纯展示，带"被拎起"的放大与投影。 */
export function CodeCellOverlay({ account, viewMode }: CodeCellOverlayProps) {
  const { code, remaining, period } = useOtpCode(account);
  return (
    <CellShell
      viewMode={viewMode}
      copied={false}
      className="dragging-overlay"
      style={{ cursor: "grabbing" }}
    >
      <CellBody
        account={account}
        code={code}
        remaining={remaining}
        period={period}
        copied={false}
        viewMode={viewMode}
        overlay
      />
    </CellShell>
  );
}
