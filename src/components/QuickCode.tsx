import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { usePlatform } from "@/platform/context";
import { useOtpCode } from "@/hooks/useOtpCode";
import { formatCode } from "@/lib/otp";
import { filterAccounts } from "@/lib/search";
import type { AccountData } from "@/lib/types";

interface QuickCodeProps {
  accounts: AccountData[];
  /** 初始查询，来自 onPluginEnter 的 payload（如 "github"） */
  initialQuery: string;
  /** Enter 命中 HOTP 时持久化 counter+1 */
  onIncrement: (id: string) => void;
}

export function QuickCode({
  accounts,
  initialQuery,
  onIncrement,
}: QuickCodeProps) {
  const platform = usePlatform();
  const [query, setQuery] = useState(initialQuery);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pickingRef = useRef(false);

  const filtered = useMemo(
    () => filterAccounts(accounts, query),
    [accounts, query],
  );

  // 接管 uTools 子搜索框
  useEffect(() => {
    platform.setSubInput?.(
      (text) => setQuery(text),
      "搜索账户名 / issuer / 备注",
      initialQuery,
    );
    return () => {
      platform.removeSubInput?.();
    };
  }, [platform, initialQuery]);

  // 查询变化时重置选中行
  const filteredKey = filtered.map((a) => a.id).join(",");
  useEffect(() => {
    setSelectedIdx(0);
  }, [filteredKey]);

  // 选中行滚到可见区
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-row-idx="${selectedIdx}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const pick = useCallback(
    (account: AccountData, code: string) => {
      if (pickingRef.current) return;
      pickingRef.current = true;

      if (account.type === "hotp") onIncrement(account.id);

      // 优先粘贴；失败降级到复制
      const ok = platform.pasteText?.(code) ?? false;
      if (!ok) {
        platform.copyText(code);
        platform.showNotification(`已复制 ${account.issuer || account.name} 验证码`);
        platform.hideWindow();
      }

      // 250ms 后允许下一次拾取（防 Enter 抖动）
      setTimeout(() => {
        pickingRef.current = false;
      }, 250);
    },
    [platform, onIncrement],
  );

  // 全局键盘流
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered.length === 0) return;
        const account = filtered[selectedIdx];
        if (!account) return;
        // code 实时从 row 拿（避免 stale closure）
        const row = listRef.current?.querySelector<HTMLElement>(
          `[data-row-idx="${selectedIdx}"]`,
        );
        const code = row?.getAttribute("data-code") ?? "";
        if (code && !code.includes("-")) pick(account, code);
      } else if (e.key === "Escape") {
        e.preventDefault();
        platform.outPlugin?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedIdx, pick, platform]);

  if (accounts.length === 0) {
    return (
      <EmptyShell
        title="还没有账户"
        hint="在 uTools 主搜索框输入「管理鹅的验证」打开管理面板添加账户"
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyShell
        title="未找到匹配的账户"
        hint={`没有账户匹配 "${query}"`}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
        {filtered.map((account, i) => (
          <QuickRow
            key={account.id}
            account={account}
            index={i}
            selected={i === selectedIdx}
            onHover={() => setSelectedIdx(i)}
            onPick={pick}
          />
        ))}
      </div>
      <Footbar count={filtered.length} total={accounts.length} />
    </div>
  );
}

/* ---------- 单行 ---------- */

interface QuickRowProps {
  account: AccountData;
  index: number;
  selected: boolean;
  onHover: () => void;
  onPick: (account: AccountData, code: string) => void;
}

function QuickRow({ account, index, selected, onHover, onPick }: QuickRowProps) {
  const { code, remaining, period } = useOtpCode(account);
  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? Math.max(0, Math.min(1, remaining / period)) : 1;
  const initial = (account.issuer || account.name || "?").trim().charAt(0).toUpperCase();
  const showSecondLine = Boolean(account.issuer && account.name);

  return (
    <div
      role="button"
      tabIndex={-1}
      data-row-idx={index}
      data-selected={selected}
      data-code={code}
      onClick={() => !code.includes("-") && onPick(account, code)}
      onMouseEnter={onHover}
      className={`
        cell-enter group relative flex h-14 cursor-pointer items-center gap-3 px-4
        transition-[background-color] duration-100
        ${selected ? "bg-surface-hover" : "hover:bg-surface/60"}
      `}
      style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}
    >
      {/* 左侧 accent 指示条 */}
      <span
        aria-hidden="true"
        className={`
          absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent
          transition-opacity duration-150
          ${selected ? "opacity-100" : "opacity-0"}
        `}
      />

      {/* 头像 */}
      <div
        className={`
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full
          text-[13px] font-semibold uppercase tabular-nums
          transition-colors duration-150
          ${selected ? "bg-accent text-accent-fg" : "bg-accent-subtle text-accent"}
        `}
        aria-hidden="true"
      >
        {initial}
      </div>

      {/* 名称区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium leading-tight text-fg">
          {account.issuer || account.name}
        </span>
        {showSecondLine && (
          <span className="mt-0.5 truncate text-[11px] leading-tight text-fg-faint">
            {account.name}
          </span>
        )}
      </div>

      {/* 码 + 指示器 */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={`
            font-mono text-[22px] font-semibold leading-none tracking-[0.06em]
            transition-colors duration-150
            ${selected ? "text-accent" : isLow ? "text-timer-low" : "text-fg"}
          `}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatCode(code)}
        </span>

        {isTotp ? (
          <ProgressRing progress={progress} isLow={isLow} selected={selected} />
        ) : (
          <span
            className={`
              inline-flex items-center rounded-full px-1.5 py-0.5
              text-[10px] font-medium uppercase tracking-wider
              ${selected ? "bg-accent/15 text-accent" : "bg-border/50 text-fg-faint"}
            `}
          >
            #{account.counter}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- 进度环 ---------- */

function ProgressRing({
  progress,
  isLow,
  selected,
}: {
  progress: number;
  isLow: boolean;
  selected: boolean;
}) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);
  const stroke = isLow
    ? "var(--color-timer-low)"
    : selected
      ? "var(--color-accent)"
      : "var(--color-accent)";
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 7 7)"
        style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.15s ease" }}
      />
    </svg>
  );
}

/* ---------- 底部提示条 ---------- */

function Footbar({ count, total }: { count: number; total: number }) {
  return (
    <div
      className="
        flex h-8 shrink-0 items-center justify-between border-t border-border/70
        bg-surface/60 px-4 text-[10.5px] text-fg-faint
      "
    >
      <span className="tabular-nums">
        {count === total ? `${total} 个账户` : `${count} / ${total}`}
      </span>
      <span className="flex items-center gap-3">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        <span>选择</span>
        <span className="text-fg-faint/60">·</span>
        <Kbd>
          <CornerDownLeft size={9} strokeWidth={2.5} />
        </Kbd>
        <span>粘贴</span>
        <span className="text-fg-faint/60">·</span>
        <Kbd>Esc</Kbd>
        <span>退出</span>
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="
        inline-flex h-4 min-w-4 items-center justify-center rounded
        border border-border bg-bg px-1
        font-sans text-[9.5px] font-medium leading-none text-fg-muted
      "
    >
      {children}
    </kbd>
  );
}

/* ---------- 空态 ---------- */

function EmptyShell({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
        <Search size={20} strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-[14px] font-semibold text-fg">{title}</h2>
      <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-fg-muted">
        {hint}
      </p>
    </div>
  );
}
