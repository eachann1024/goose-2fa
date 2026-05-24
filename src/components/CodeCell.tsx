import { useState, useCallback, useRef } from "react";
import { RefreshCw, Check, Info } from "lucide-react";
import { useOtpCode } from "@/hooks/useOtpCode";
import { formatCode } from "@/lib/otp";
import type { AccountData } from "@/lib/types";

interface CodeCellProps {
  account: AccountData;
  onCopy: (text: string) => void;
  onDetail: (account: AccountData) => void;
  onIncrement: (id: string) => void;
  index: number;
}

export function CodeCell({
  account,
  onCopy,
  onDetail,
  onIncrement,
  index,
}: CodeCellProps) {
  const { code, remaining, period } = useOtpCode(account);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? remaining / period : 1;
  const displayName = account.issuer
    ? `${account.issuer} (${account.name})`
    : account.name;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCopy(); }}
      className={`cell-enter group relative flex w-full cursor-pointer flex-col items-start rounded-cell border p-4 pb-3 text-left transition-all duration-150 ${
        copied
          ? "copied-flash border-copied/30"
          : "bg-surface hover:bg-surface-hover hover:border-fg-faint/30 active:scale-[0.98]"
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <button
        onClick={handleDetailClick}
        className="absolute right-2.5 top-2.5 rounded-md p-1 text-fg-faint opacity-0 transition-all hover:bg-bg hover:text-fg-muted group-hover:opacity-100"
        aria-label="详情"
      >
        <Info size={13} />
      </button>

      <span className="mb-1.5 max-w-[calc(100%-24px)] truncate text-[12px] leading-tight text-fg-muted">
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

        {!isTotp && !copied && (
          <button
            onClick={handleRefresh}
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
            className={`timer-bar h-full rounded-full ${
              isLow ? "bg-timer-low" : "bg-accent/70"
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {!isTotp && (
        <div className="mt-3 flex items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">
            HOTP
          </span>
          <span className="text-[10px] text-fg-faint">
            #{account.counter}
          </span>
        </div>
      )}
    </div>
  );
}
