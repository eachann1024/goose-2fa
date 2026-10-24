import { memo } from "react";
import { useTimerReady } from "@/hooks/useTimerReady";
import { RefreshCw, Check, Info, PenLine } from "lucide-react";
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

const detailHit =
  "flex items-center justify-center rounded-lg text-fg-muted opacity-0 pointer-events-none transition-colors hover:bg-accent-subtle hover:text-accent focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 active:bg-accent-subtle";

// 拖动时 useSortable 每帧都会让 CodeCell 重渲染，memo 让卡片内容跳过这部分工作。
export const CellBody = memo(function CellBody({
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
  const timerReady = useTimerReady(`${account.id}:${viewMode}`);
  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? remaining / period : 1;
  const { title, subtitle } = cardLabels(account);
  const remark = account.remark?.trim() ?? "";
  const isList = viewMode === "list";
  const isCompact = viewMode === "compact";

  if (isList) {
    return (
      <>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="mb-1 flex min-w-0 items-baseline gap-1.5 leading-tight">
            <span className={`${subtitle ? "max-w-[60%] shrink-0" : "min-w-0"} truncate text-[12.5px] font-semibold text-fg`}>{title}</span>
            {subtitle && <span className="truncate text-[11.5px] text-fg-faint">{subtitle}</span>}
            {remark && <span className="truncate text-[11.5px] text-fg-muted">· {remark}</span>}
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
                className={`timer-ring ${!timerReady || remaining === period ? "timer-reset" : ""} ${isLow ? "stroke-timer-low" : "stroke-accent"}`}
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
                className="rounded-md p-1 text-fg-faint transition-colors hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
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
            className={`${detailHit} size-11 shrink-0`}
            aria-label="详情"
          >
            <Info size={20} />
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
            className={`${detailHit} absolute right-1.5 top-1.5 size-7 before:absolute before:right-0 before:top-0 before:size-14 before:content-['']`}
            aria-label="详情"
          >
            <Info size={18} />
          </button>
        )}

        <span className="mb-1 flex min-w-0 max-w-[calc(100%-52px)] items-baseline gap-1 leading-tight">
          <span className={`${subtitle ? "max-w-[60%] shrink-0" : "min-w-0"} truncate text-[10.5px] font-semibold text-fg`}>{title}</span>
          {subtitle && <span className="truncate text-[10px] text-fg-faint">{subtitle}</span>}
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
              className="rounded-md p-0.5 text-fg-faint transition-colors hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
              aria-label="下一个"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>

        {isTotp && (
          <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-border">
            <div
              className={`timer-bar h-full rounded-full ${!timerReady || remaining === period ? "timer-reset" : ""} ${isLow ? "bg-timer-low" : "bg-accent"}`}
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

        {remark && <RemarkLine remark={remark} size={9} className="mt-1.5 text-[10px]" />}
      </>
    );
  }

  // 双列网格视图
  return (
    <>
      {!overlay && (
        <button
          onClick={onDetailClick}
          className={`${detailHit} absolute right-1.5 top-1.5 size-8 before:absolute before:right-0 before:top-0 before:size-16 before:content-['']`}
          aria-label="详情"
        >
          <Info size={20} />
        </button>
      )}

      <span className="mb-1.5 flex min-w-0 max-w-[calc(100%-58px)] items-baseline gap-1.5 leading-tight">
        <span className={`${subtitle ? "max-w-[60%] shrink-0" : "min-w-0"} truncate text-[13px] font-semibold text-fg`}>{title}</span>
        {subtitle && <span className="truncate text-[12px] text-fg-faint">{subtitle}</span>}
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
            className="rounded-md p-1 text-fg-faint transition-colors hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
            aria-label="下一个"
          >
            <RefreshCw size={15} />
          </button>
        )}
      </div>

      {isTotp && (
        <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-border-soft">
          <div
            className={`timer-bar h-full rounded-full ${!timerReady || remaining === period ? "timer-reset" : ""} ${isLow ? "bg-timer-low" : "bg-accent"}`}
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

      {remark && <RemarkLine remark={remark} size={12} className="mt-2 text-[12px]" />}
    </>
  );
});

function RemarkLine({ remark, size, className }: { remark: string; size: number; className: string }) {
  return (
    <span className={`flex w-full min-w-0 items-center gap-1.5 leading-tight text-fg-muted ${className}`}>
      <PenLine size={size} className="shrink-0 text-fg-faint" />
      <span className="truncate">{remark}</span>
    </span>
  );
}

/** 导入的 issuer 偶尔带包裹引号，如 "xAI" */
function stripQuotes(value: string) {
  return value.trim().replace(/^(["'“”‘’])(.*)\1$|^[“‘](.*)[”’]$/, "$2$3").trim();
}

/** 卡片标题：自定义显示名 > 服务商 > 账户名；副标题：账户名（与标题重复时省略） */
function cardLabels(account: AccountData) {
  const issuer = stripQuotes(account.issuer ?? "");
  const name = account.name.trim();
  const note = account.note?.trim();
  const title = note || issuer || name;
  const subtitle = name && name !== title ? name : "";
  return { title, subtitle };
}
