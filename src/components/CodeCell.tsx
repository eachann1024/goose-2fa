import { useState, useCallback, useRef } from "react";
import { RefreshCw, Check, Info, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOtpCode } from "@/hooks/useOtpCode";
import { formatCode } from "@/lib/otp";
import type { AccountData } from "@/lib/types";
import type { ViewMode } from "@/stores/useAccounts";

interface CodeCellProps {
  account: AccountData;
  onCopy: (text: string) => void;
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
  index,
  viewMode,
  sortable,
}: CodeCellProps) {
  const { code, remaining, period } = useOtpCode(account);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id, disabled: !sortable });

  const handleCopy = useCallback(() => {
    onCopy(code);
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

  const isList = viewMode === "list";

  // 拖动源：拖起后留在原位作半透明"空位"，真正跟手的视觉由 DragOverlay 接管。
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging
      ? { opacity: 0.4 }
      : { animationDelay: `${index * 40}ms` }),
  };

  // 拖拽手柄：sortable 时显示，按住它才触发拖动，其余区域仍可点击复制。
  const handle = sortable ? (
    <button
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className={`drag-handle shrink-0 cursor-grab touch-none rounded-md p-1 text-fg-faint opacity-0 transition-all hover:bg-bg hover:text-fg-muted group-hover:opacity-100 active:cursor-grabbing ${
        isList ? "" : "absolute left-1.5 top-2.5"
      }`}
      aria-label="拖动排序"
    >
      <GripVertical size={isList ? 15 : 13} />
    </button>
  ) : null;

  return (
    <CellShell
      ref={setNodeRef}
      style={style}
      viewMode={viewMode}
      copied={copied}
      onClick={handleCopy}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCopy(); }}
      interactive
    >
      {handle}
      <CellBody
        account={account}
        code={code}
        remaining={remaining}
        period={period}
        copied={copied}
        viewMode={viewMode}
        sortable={sortable}
        onDetailClick={handleDetailClick}
        onRefresh={handleRefresh}
      />
    </CellShell>
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
        sortable
        overlay
      />
    </CellShell>
  );
}

/* ---------- 外壳：统一 list/grid 的容器样式 ---------- */

interface CellShellProps {
  viewMode: ViewMode;
  copied: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  ref?: React.Ref<HTMLDivElement>;
}

function CellShell({
  viewMode,
  copied,
  children,
  className = "",
  style,
  interactive,
  onClick,
  onKeyDown,
  ref,
}: CellShellProps) {
  const isList = viewMode === "list";
  const layout = isList
    ? "flex w-full items-center gap-3 px-3.5 py-3"
    : "flex w-full flex-col items-start p-4 pb-3";
  const base = copied
    ? "copied-flash border-copied/30"
    : interactive
      ? "bg-surface hover:bg-surface-hover hover:border-fg-faint/30 " +
        (isList ? "active:scale-[0.99]" : "active:scale-[0.98]")
      : "bg-surface";

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={interactive ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={style}
      className={`${className.includes("dragging-overlay") ? "" : "cell-enter"} group relative cursor-pointer rounded-cell border text-left transition-all duration-150 ${layout} ${base} ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- 主体内容：list / grid 两种排布 ---------- */

interface CellBodyProps {
  account: AccountData;
  code: string;
  remaining: number;
  period: number;
  copied: boolean;
  viewMode: ViewMode;
  sortable: boolean;
  overlay?: boolean;
  onDetailClick?: (e: React.MouseEvent) => void;
  onRefresh?: (e: React.MouseEvent) => void;
}

function CellBody({
  account,
  code,
  remaining,
  period,
  copied,
  viewMode,
  sortable,
  overlay,
  onDetailClick,
  onRefresh,
}: CellBodyProps) {
  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? remaining / period : 1;
  const displayName = account.issuer
    ? `${account.issuer} (${account.name})`
    : account.name;
  const isList = viewMode === "list";

  if (isList) {
    return (
      <>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="mb-0.5 truncate text-[12px] leading-tight text-fg-muted">
            {displayName}
          </span>
          <span
            className={`flex items-center font-mono text-[22px] font-semibold leading-none tracking-[0.08em] transition-colors duration-200 ${
              copied ? "text-copied" : isLow ? "text-timer-low" : "text-fg"
            }`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {copied ? (
              <span className="flex items-center gap-1.5 text-[16px]">
                <Check size={16} strokeWidth={2.5} />
                已复制
              </span>
            ) : (
              formatCode(code)
            )}
          </span>
        </div>

        {isTotp ? (
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-border/60" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
                className={`timer-ring ${isLow ? "stroke-timer-low" : "stroke-accent/70"}`}
                strokeDasharray={2 * Math.PI * 15.5}
                strokeDashoffset={2 * Math.PI * 15.5 * (1 - progress)}
              />
            </svg>
            <span className="absolute text-[10px] font-medium tabular-nums text-fg-faint">
              {Math.ceil(remaining)}
            </span>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] text-fg-faint">#{account.counter}</span>
            {!copied && !overlay && (
              <button
                onClick={onRefresh}
                className="rounded-md p-1 text-fg-faint transition-colors hover:bg-bg hover:text-accent"
                aria-label="下一个"
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        )}

        {!overlay && (
          <button
            onClick={onDetailClick}
            className="shrink-0 rounded-md p-1 text-fg-faint opacity-0 transition-all hover:bg-bg hover:text-fg-muted group-hover:opacity-100"
            aria-label="详情"
          >
            <Info size={14} />
          </button>
        )}
      </>
    );
  }

  // 网格视图
  return (
    <>
      {!overlay && (
        <button
          onClick={onDetailClick}
          className="absolute right-2.5 top-2.5 rounded-md p-1 text-fg-faint opacity-0 transition-all hover:bg-bg hover:text-fg-muted group-hover:opacity-100"
          aria-label="详情"
        >
          <Info size={13} />
        </button>
      )}

      <span
        className={`mb-1.5 max-w-[calc(100%-24px)] truncate text-[12px] leading-tight text-fg-muted ${
          sortable ? "pl-5" : ""
        }`}
      >
        {displayName}
      </span>

      <div className="flex w-full items-center justify-between">
        <span
          className={`flex h-[26px] items-center font-mono text-[26px] font-semibold leading-none tracking-[0.08em] transition-colors duration-200 ${
            copied ? "text-copied" : isLow ? "text-timer-low" : "text-fg"
          }`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {copied ? (
            <span className="flex items-center gap-1.5 text-[18px]">
              <Check size={18} strokeWidth={2.5} />
              已复制
            </span>
          ) : (
            formatCode(code)
          )}
        </span>

        {!isTotp && !copied && !overlay && (
          <button
            onClick={onRefresh}
            className="rounded-md p-1 text-fg-faint transition-colors hover:bg-bg hover:text-accent"
            aria-label="下一个"
          >
            <RefreshCw size={15} />
          </button>
        )}
      </div>

      {isTotp && (
        <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-border/60">
          <div
            className={`timer-bar h-full rounded-full ${isLow ? "bg-timer-low" : "bg-accent/70"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {!isTotp && (
        <div className="mt-3 flex items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">
            HOTP
          </span>
          <span className="text-[10px] text-fg-faint">#{account.counter}</span>
        </div>
      )}
    </>
  );
}
