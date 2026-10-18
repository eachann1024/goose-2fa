import { RefreshCw, Check, Info } from "lucide-react";
import { formatCode } from "@/lib/otp";
import type { AccountData } from "@/lib/types";
import type { ViewMode } from "@/stores/useAccounts";

interface CellBodyProps {
  account: AccountData;
  code: string;
  remaining: number;
  period: number;
  copied: boolean;
  copyError?: boolean;
  viewMode: ViewMode;
  overlay?: boolean;
  onDetailClick?: (e: React.MouseEvent) => void;
  onRefresh?: (e: React.MouseEvent) => void;
}

export function CellBody({
  account,
  code,
  remaining,
  period,
  copied,
  copyError,
  viewMode,
  overlay,
  onDetailClick,
  onRefresh,
}: CellBodyProps) {
  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? remaining / period : 1;
  const originalName = account.originalName
    || (account.issuer ? `${account.issuer} (${account.name})` : account.name);
  const displayName = account.note || originalName;
  const isList = viewMode === "list";
  const isCompact = viewMode === "compact";

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
            {copyError ? (
              <span className="text-[13px] text-timer-low">复制失败</span>
            ) : copied ? (
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
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-border-soft" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
                className={`timer-ring ${remaining === period ? "timer-reset" : ""} ${isLow ? "stroke-timer-low" : "stroke-accent"}`}
                strokeDasharray={2 * Math.PI * 15.5}
                style={{ strokeDashoffset: 2 * Math.PI * 15.5 * (1 - progress) }}
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
                className="rounded-md p-1 text-fg-faint transition-colors hover:bg-bg hover:text-accent active:bg-surface-active"
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
            className="shrink-0 rounded-md p-1 text-fg-faint opacity-0 transition-all hover:bg-bg hover:text-fg-muted focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 active:bg-surface-active"
            aria-label="详情"
          >
            <Info size={14} />
          </button>
        )}
      </>
    );
  }


  if (isCompact) {
    return (
      <>
        {!overlay && (
          <button
            onClick={onDetailClick}
            className="absolute right-2 top-2 rounded-md p-0.5 text-fg-faint opacity-0 transition-all hover:bg-bg hover:text-fg-muted focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 active:bg-surface-active"
            aria-label="详情"
          >
            <Info size={11} />
          </button>
        )}

        <span
          className="mb-1 max-w-[calc(100%-20px)] truncate text-[10px] leading-tight text-fg-muted"
        >
          {displayName}
        </span>

        <div className="flex w-full items-center justify-between">
          <span
            className={`flex h-[22px] items-center font-mono text-[18px] font-semibold leading-none tracking-[0.06em] transition-colors duration-200 ${
              copied ? "text-copied" : isLow ? "text-timer-low" : "text-fg"
            }`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {copyError ? (
              <span className="text-[11px] text-timer-low">复制失败</span>
            ) : copied ? (
              <span className="flex items-center gap-1 text-[13px]">
                <Check size={13} strokeWidth={2.5} />
                已复制
              </span>
            ) : (
              formatCode(code)
            )}
          </span>

          {!isTotp && !copied && !overlay && (
            <button
              onClick={onRefresh}
              className="rounded-md p-0.5 text-fg-faint transition-colors hover:bg-bg hover:text-accent active:bg-surface-active"
              aria-label="下一个"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        {isTotp && (
          <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-border">
            <div
              className={`timer-bar h-full rounded-full ${remaining === period ? "timer-reset" : ""} ${isLow ? "bg-timer-low" : "bg-accent"}`}
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        )}

        {!isTotp && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-[9px] font-medium uppercase tracking-wider text-fg-faint">
              HOTP
            </span>
            <span className="text-[9px] text-fg-faint">#{account.counter}</span>
          </div>
        )}
      </>
    );
  }

  // 双列网格视图
  return (
    <>
      {!overlay && (
        <button
          onClick={onDetailClick}
          className="absolute right-2.5 top-2.5 rounded-md p-1 text-fg-faint opacity-0 transition-all hover:bg-bg hover:text-fg-muted focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 active:bg-surface-active"
          aria-label="详情"
        >
          <Info size={13} />
        </button>
      )}

      <span
        className="mb-1.5 max-w-[calc(100%-24px)] truncate text-[12px] leading-tight text-fg-muted"
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
          {copyError ? (
            <span className="text-[15px] text-timer-low">复制失败</span>
          ) : copied ? (
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
            className="rounded-md p-1 text-fg-faint transition-colors hover:bg-bg hover:text-accent active:bg-surface-active"
            aria-label="下一个"
          >
            <RefreshCw size={15} />
          </button>
        )}
      </div>

      {isTotp && (
        <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-border-soft">
          <div
            className={`timer-bar h-full rounded-full ${remaining === period ? "timer-reset" : ""} ${isLow ? "bg-timer-low" : "bg-accent"}`}
            style={{ transform: `scaleX(${progress})` }}
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
