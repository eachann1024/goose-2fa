import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, Check, Copy, KeyRound, QrCode, Trash2 } from "lucide-react";
import { useOtpCode } from "@/hooks/useOtpCode";
import { useTimerReady } from "@/hooks/useTimerReady";
import { formatCode, generateHOTP, generateTOTP } from "@/lib/otp";
import type { AccountData, VaultGroup } from "@/lib/types";
import { EditableText } from "@/components/ui/editable-text";
import { AccountMetadata } from "@/components/AccountMetadata";
import { AccountShare, type ShareMode } from "@/components/AccountShare";
import { useAccounts } from "@/stores/useAccounts";
import { canEditVault } from "@/stores/accounts/write-guard";


interface AccountDetailProps {
  account: AccountData;
  groups: VaultGroup[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => boolean | Promise<boolean>;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateRemark: (id: string, remark: string) => void;
  onUpdateGroup: (id: string, groupId: string | null) => void;
  onUpdateSecret?: (id: string, secretInput: string) => AccountData | null;
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
  onUpdateSecret,
}: AccountDetailProps) {
  const updateSecret = useAccounts((state) => state.updateSecret);
  const editable = useAccounts(canEditVault);
  const { code, remaining, period } = useOtpCode(account);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode | null>(null);
  const barReady = useTimerReady(account.id);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyGenerationRef = useRef(0);

  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? remaining / period : 1;

  const originalName = account.originalName
    || (account.issuer ? `${account.issuer} (${account.name})` : account.name);

  const displayName = account.note || originalName;

  useEffect(() => {
    setCopied(false);
    setCopyError(false);
    return () => {
      copyGenerationRef.current += 1;
      clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!/^\d+$/.test(code)) return;
    const generation = copyGenerationRef.current;
    setCopyError(false);
    const success = await onCopy(code);
    if (generation !== copyGenerationRef.current) return;
    if (!success) {
      setCopyError(true);
      return;
    }
    setCopied(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1200);
  }, [code, onCopy]);

  const handleUpdateSecret = async (secretInput: string) => {
    const generation = copyGenerationRef.current;
    const updated = (onUpdateSecret ?? updateSecret)(account.id, secretInput);
    if (!updated) return false;
    try {
      const newCode = updated.type === "hotp"
        ? await generateHOTP(updated.secret, updated.counter, updated.digits, updated.algorithm)
        : (await generateTOTP(updated.secret, updated.period, updated.digits, updated.algorithm)).code;
      if (generation !== copyGenerationRef.current) return true;
      setShareMode(null);
      setCopyError(false);
      const success = await onCopy(newCode);
      if (generation !== copyGenerationRef.current) return true;
      if (success) {
        setCopied(true);
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 1200);
      } else setCopyError(true);
    } catch {
      if (generation !== copyGenerationRef.current) return true;
      setShareMode(null);
      setCopyError(true);
    }
    return true;
  };

  // 详情页复用同一实例切换账户时，收起上一个账户的二维码 / 密钥。
  useEffect(() => {
    setShareMode(null);
  }, [account.id]);

  const toggleShare = (mode: ShareMode) => setShareMode((current) => (current === mode ? null : mode));

  const remark = account.remark ?? "";

  const sharing = shareMode !== null;

  return (
    <div className="flex min-h-full flex-col bg-bg">
      {/* 顶栏固定；点开二维码或密钥时，下面只留被点开的面板 */}
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-bg px-5 pb-3 pt-4">
        <button
          autoFocus
          onClick={onClose}
          className="icon-control rounded-lg p-2 text-fg-muted"
          aria-label="返回"
          title="返回"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => toggleShare("qr")}
          aria-pressed={shareMode === "qr"}
          className="icon-control rounded-lg p-2 text-fg-muted aria-pressed:bg-accent-subtle aria-pressed:text-accent"
          aria-label="二维码"
          title="二维码"
        >
          <QrCode size={17} />
        </button>
        <button
          type="button"
          onClick={() => toggleShare("secret")}
          aria-pressed={shareMode === "secret"}
          className="icon-control rounded-lg p-2 text-fg-muted aria-pressed:bg-accent-subtle aria-pressed:text-accent"
          aria-label="密钥"
          title="密钥"
        >
          <KeyRound size={17} />
        </button>
        <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
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

      <div className="flex flex-1 flex-col px-5 pb-6">
      {sharing ? (
        <AccountShare account={account} open={shareMode} editable={editable} onClose={() => setShareMode(null)} onCopy={onCopy} onUpdateSecret={handleUpdateSecret} />
      ) : (
      <>
      <div className="mb-5">
        <EditableText
          key={`${account.id}-name`}
          label="账户名称"
          value={displayName}
          placeholder={originalName}
          variant="heading"
          selectOnFocus
          multiline
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
            multiline
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
            : "bg-surface hover:border-accent hover:bg-accent-subtle active:scale-[0.98]"
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
        onUpdateGroup={onUpdateGroup}
      />
      </>
      )}
      </div>
    </div>
  );
}
