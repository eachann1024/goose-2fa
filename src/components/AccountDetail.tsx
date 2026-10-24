import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, Check, Copy, Trash2 } from "lucide-react";
import { useOtpCode } from "@/hooks/useOtpCode";
import { useTimerReady } from "@/hooks/useTimerReady";
import { formatCode } from "@/lib/otp";
import type { AccountData, VaultGroup } from "@/lib/types";
import { EditableText } from "@/components/ui/editable-text";
import { AccountMetadata } from "@/components/AccountMetadata";

interface AccountDetailProps {
  account: AccountData;
  groups: VaultGroup[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => boolean | Promise<boolean>;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateRemark: (id: string, remark: string) => void;
  onUpdateGroup: (id: string, groupId: string | null) => void;
}

export function AccountDetail({
  account,
  groups,
  onClose,
  onDelete,
  onCopy,
  onUpdateNote,
  onUpdateRemark,
  onUpdateGroup,
}: AccountDetailProps) {
  const { code, remaining, period } = useOtpCode(account);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const barReady = useTimerReady(account.id);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? remaining / period : 1;

  const originalName = account.originalName
    || (account.issuer ? `${account.issuer} (${account.name})` : account.name);

  const displayName = account.note || originalName;

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleCopy = useCallback(async () => {
    setCopyError(false);
    const success = await onCopy(code);
    if (!success) {
      setCopyError(true);
      return;
    }
    setCopied(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1200);
  }, [code, onCopy]);

  const remark = account.remark ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-bg px-5 pb-6 pt-4">
      {/* 顶栏 */}
      <div className="mb-6 flex items-center gap-2">
        <button
          autoFocus
          onClick={onClose}
          className="icon-control rounded-lg p-2 text-fg-muted"
          aria-label="返回"
        >
          <ArrowLeft size={17} />
        </button>
        <span className="text-[15px] font-serif font-semibold tracking-tight text-fg">
          账户详情
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onDelete(account.id)}
          className="icon-control rounded-lg p-2 text-timer-low"
          aria-label="删除账户"
          title="删除账户"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="mb-5">
        <EditableText
          key={`${account.id}-name`}
          label="账户名称"
          value={displayName}
          placeholder={originalName}
          variant="heading"
          selectOnFocus
          onSave={(value) => {
            const next = !value || value === originalName ? "" : value;
            if (next !== (account.note ?? "")) onUpdateNote(account.id, next);
          }}
        />
        <div className="mt-2">
          <EditableText
            key={`${account.id}-remark`}
            label="账户备注"
            value={remark}
            placeholder="添加备注"
            onSave={(value) => onUpdateRemark(account.id, value)}
          />
        </div>
      </div>

      {/* 验证码区 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => void handleCopy()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void handleCopy();
          }
        }}
        className={`mb-2 flex cursor-pointer items-center justify-between rounded-cell border p-5 transition-all duration-150 ${
          copied
            ? "copied-flash border-copied-border"
            : "bg-surface hover:bg-surface-hover active:scale-[0.98]"
        }`}
      >
        <span
          className={`flex h-[34px] items-center font-mono text-[34px] font-semibold leading-none tracking-[0.08em] transition-colors duration-200 ${
            copied ? "text-copied" : isLow ? "text-timer-low" : "text-fg"
          }`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {copied ? (
            <span className="flex items-center gap-2 text-[22px]">
              <Check size={22} strokeWidth={2.5} />
              已复制
            </span>
          ) : (
            formatCode(code)
          )}
        </span>
        {!copied && (
          <Copy size={17} className="text-fg-faint" />
        )}
      </div>
      {copyError && (
        <p role="alert" className="mb-2 text-[12px] text-timer-low">
          复制失败，请检查剪贴板权限后重试
        </p>
      )}

      {/* 进度条 */}
      {isTotp && (
        <div className="mb-6 h-[4px] w-full overflow-hidden rounded-full bg-border-soft">
          <div
            className={`timer-bar h-full rounded-full ${
              isLow ? "bg-timer-low" : "bg-accent"
            } ${barReady && remaining !== period ? "" : "timer-reset"}`}
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      )}

      {!isTotp && (
        <div className="mb-6 flex items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">
            HOTP
          </span>
          <span className="text-[10px] text-fg-faint">
            #{account.counter}
          </span>
        </div>
      )}

      <AccountMetadata
        account={account}
        groups={groups}
        originalName={originalName}
        displayName={displayName}
        onUpdateGroup={onUpdateGroup}
      />


    </div>
  );
}
