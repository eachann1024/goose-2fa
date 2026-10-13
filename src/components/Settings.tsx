import { ArrowLeft, Check, FolderOpen, FilePlus2, LockOpen, RefreshCw } from "lucide-react";
import { usePlatform } from "@/platform/context";
import { useAccounts } from "@/stores/useAccounts";

/**
 * 开关用原生按钮实现：项目未把 shadcn Switch 纳入 Tailwind 扫描，且它带着 /alpha 与裸调色板类，
 * 会破坏 Chrome 108 的实色 token 约束。
 */
function SwitchButton({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="启用文件同步模式"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "border-accent bg-accent" : "border-transparent bg-fg-faint"
      }`}
    >
      <span
        className={`block size-4 rounded-full bg-surface transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

/** 小号次要按钮，与设置页其它行内操作保持同一视觉。 */
function InlineButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-8 items-center gap-1 rounded-lg border bg-surface px-2.5 text-[11.5px] text-fg-muted hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-fg-faint"
    >
      {children}
    </button>
  );
}

export function Settings({ onBack }: { onBack: () => void }) {
  const platform = usePlatform();
  const enabled = useAccounts((s) => s.syncEnabled);
  const path = useAccounts((s) => s.syncPath);
  const status = useAccounts((s) => s.syncStatus);
  const error = useAccounts((s) => s.syncError);
  const notice = useAccounts((s) => s.syncNotice);
  const needsCreate = useAccounts((s) => s.syncNeedsCreate);
  const lockHeld = useAccounts((s) => s.syncLockHeld);
  const setEnabled = useAccounts((s) => s.setSyncEnabled);
  const selectPath = useAccounts((s) => s.selectSyncPath);
  const retry = useAccounts((s) => s.retrySync);
  const refresh = useAccounts((s) => s.refreshSync);
  const createFile = useAccounts((s) => s.createSyncFile);
  const clearLock = useAccounts((s) => s.clearSyncLock);
  const resolveConflict = useAccounts((s) => s.resolveSyncConflict);
  const supported = platform.supportsFileSync === true;
  const busy = status === "reading" || status === "writing";

  return (
    <div className="slide-in flex min-h-screen flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <button onClick={onBack} className="icon-control rounded-lg p-2 text-fg-muted" aria-label="返回">
          <ArrowLeft size={17} />
        </button>
        <h2 className="flex-1 text-[15px] font-serif font-semibold tracking-tight text-fg">设置</h2>
      </div>
      <main className="flex flex-col gap-5 px-4 pt-3">
        <section className="rounded-cell border bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold text-fg">文件同步模式</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">
                uTools 默认使用文档目录下的 JSON 文件。每次打开读取文件，账户和设置改动自动保存。
              </p>
            </div>
            <SwitchButton
              checked={enabled}
              onToggle={() => setEnabled(!enabled)}
              disabled={!supported || !path || busy}
            />
          </div>

          <p className="mt-3 truncate text-[12px] text-fg-muted" title={path}>{path || "尚未指定数据源文件"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <InlineButton onClick={() => void selectPath("existing")} disabled={!supported || busy}>
              <FolderOpen size={12} />选择已有文件
            </InlineButton>
            <InlineButton onClick={() => void selectPath("new")} disabled={!supported || busy}>
              <FilePlus2 size={12} />指定位置新建
            </InlineButton>
          </div>
          {!supported && <p className="mt-2 text-[11.5px] text-fg-faint">浏览器预览不支持数据源文件读写。</p>}
          {status === "reading" && <p className="mt-3 text-[12px] text-fg-muted" aria-live="polite">正在读取数据源文件…</p>}
          {status === "writing" && <p className="mt-3 text-[12px] text-fg-muted" aria-live="polite">正在写入数据源文件…</p>}
          {status === "success" && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-copied" aria-live="polite">
              <Check size={14} />
              {notice ?? "已同步"}
            </p>
          )}
          {error && (
            <p className="mt-3 text-[12px] leading-relaxed text-timer-low" role="alert">
              {error}
            </p>
          )}
          {supported && path && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <InlineButton onClick={refresh} disabled={busy}>
                <RefreshCw size={12} />重新读取文件
              </InlineButton>
              {needsCreate && enabled && (
                <InlineButton onClick={createFile} disabled={busy}>
                  <FilePlus2 size={12} />新建数据源文件
                </InlineButton>
              )}
              {status === "conflict" && (
                <>
                  <InlineButton onClick={() => resolveConflict("file")} disabled={busy}>
                    以文件为准
                  </InlineButton>
                  <InlineButton onClick={() => resolveConflict("local")} disabled={busy}>
                    以本地为准
                  </InlineButton>
                </>
              )}
              {status === "error" && !needsCreate && (
                <InlineButton onClick={retry} disabled={busy}>
                  重试保存
                </InlineButton>
              )}
              {lockHeld && (
                <InlineButton onClick={clearLock} disabled={busy}>
                  <LockOpen size={12} />清理残留锁文件
                </InlineButton>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
