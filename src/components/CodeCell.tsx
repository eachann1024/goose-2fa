import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOtpCode } from "@/hooks/useOtpCode";
import { generateTOTP } from "@/lib/otp";
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
  viewMode: ViewMode;
  sortable: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const CodeCell = memo(function CodeCell({
  account,
  onCopy,
  onDetail,
  onIncrement,
  viewMode,
  sortable,
  selectionMode,
  selected,
  onToggleSelect,
}: CodeCellProps) {
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

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.4 } : {}),
  };

  return (
    <LiveCodeCell
      account={account}
      onCopy={onCopy}
      onDetail={onDetail}
      onIncrement={onIncrement}
      viewMode={viewMode}
      selectionMode={selectionMode}
      selected={selected}
      onToggleSelect={onToggleSelect}
      nodeRef={setNodeRef}
      activatorRef={setActivatorNodeRef}
      activatorProps={sortable ? { ...attributes, ...listeners } : undefined}
      style={style}
      isDragging={isDragging}
      isSorting={isSorting}
    />
  );
});

interface LiveCodeCellProps extends Omit<CodeCellProps, "sortable"> {
  nodeRef: React.Ref<HTMLDivElement>;
  activatorRef: React.Ref<HTMLButtonElement>;
  activatorProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  style: React.CSSProperties;
  isDragging: boolean;
  isSorting: boolean;
}

function LiveCodeCell({
  account, onCopy, onDetail, onIncrement, viewMode, nodeRef,
  activatorRef, activatorProps, style, isDragging, isSorting,
  selectionMode, selected, onToggleSelect,
}: LiveCodeCellProps) {
  const { code, remaining, period } = useOtpCode(account);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyGeneration = useRef(0);

  useEffect(() => {
    setCopied(false);
    setCopyError(false);
    return () => {
      copyGeneration.current += 1;
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!/^\d+$/.test(code)) return;
    const generation = ++copyGeneration.current;
    clearTimeout(timeoutRef.current);
    setCopied(false);
    setCopyError(false);
    let copyCode = code;
    if (account.type === "totp") {
      try {
        copyCode = (await generateTOTP(account.secret, account.period || 30, account.digits, account.algorithm)).code;
      } catch {
        copyCode = "ERROR";
      }
    }
    if (generation !== copyGeneration.current) return;
    const success = copyCode !== "------" && copyCode !== "ERROR" && await onCopy(copyCode);
    if (generation !== copyGeneration.current) return;
    if (!success) {
      setCopyError(true);
      timeoutRef.current = setTimeout(() => setCopyError(false), 1800);
      return;
    }
    setCopied(true);
    timeoutRef.current = setTimeout(() => setCopied(false), 1200);
  }, [account, code, onCopy]);

  const handleDetailClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDetail(account);
    },
    [account, onDetail],
  );

  const handleSelect = useCallback(() => {
    onToggleSelect?.(account.id);
  }, [account.id, onToggleSelect]);

  const handleRefresh = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onIncrement(account.id);
    },
    [account.id, onIncrement],
  );

  return (
    <AccountContextMenu account={account} disabled={isDragging || Boolean(selectionMode)} onCopy={handleCopy} onDetail={onDetail}>
      <CellShell
        ref={nodeRef}
        style={style}
        viewMode={viewMode}
        copied={copied}
        className={isDragging ? "dragging-source" : isSorting ? "dragging-sibling" : ""}
        onClick={selectionMode ? handleSelect : () => void handleCopy()}
        copyLabel={
          selectionMode
            ? `${selected ? "取消选择" : "选择"} ${account.note || account.issuer || account.name}`
            : `复制 ${account.note || account.issuer || account.name} 的验证码`
        }
        selected={Boolean(selectionMode && selected)}
        pressed={selectionMode ? Boolean(selected) : undefined}
        interactive
        activatorRef={activatorRef}
        activatorProps={activatorProps}
      >
        <CellBody
          account={account}
          code={code}
          remaining={remaining}
          period={period}
          copied={copied}
          copyError={copyError}
          viewMode={viewMode}
          selectionMode={selectionMode}
          selected={selected}
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
