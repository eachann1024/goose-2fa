import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ClipboardPaste,
  ScanLine,
  Clock,
  Hash,
} from "lucide-react";
import { parseSecretInput } from "@/lib/secret-input";
import { useAccountImport } from "./useAccountImport";
import { Input } from "@/components/ui/input";
import type { NewAccountInput, ParsedOtpAuth } from "@/lib/types";

interface AddAccountProps {
  onAdd: (input: NewAccountInput) => void;
  onBatchAdd?: (inputs: NewAccountInput[]) => void;
  onCancel: () => void;
  /** Auto-trigger an action on mount: "clipboard" or "capture" */
  initialAction?: "clipboard" | "capture";
}

type OtpType = "totp" | "hotp";
type FormError = { field: "name" | "secret"; message: string } | null;

export function AddAccount({ onAdd, onBatchAdd, onCancel, initialAction }: AddAccountProps) {
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [type, setType] = useState<OtpType>("totp");
  const [error, setError] = useState<FormError>(null);
  const [importedAccount, setImportedAccount] = useState<ParsedOtpAuth | null>(null);
  const handleSecretInput = useCallback((text: string) => {
    const parsed = parseSecretInput(text);
    setSecret(parsed?.secret ?? text);
    setImportedAccount(parsed?.account ?? null);
    if (parsed?.account) {
      const accountName = parsed.account.name || parsed.account.issuer;
      setName((current) => current.trim() ? current : accountName);
    }
    setError(null);
  }, []);
  const { importError, handleClipboardImport, handleScreenCapture } = useAccountImport({
    onAdd, onBatchAdd, initialAction, onSecretInput: handleSecretInput,
  });

  const handleSubmit = useCallback(() => {
    const parsed = parseSecretInput(secret);
    const account = parsed?.account ?? importedAccount;
    const trimmedName = name.trim() || account?.name || account?.issuer || "";

    if (!trimmedName) {
      setError({ field: "name", message: "请输入账户名称" });
      return;
    }
    if (!secret.trim()) {
      setError({ field: "secret", message: "请输入密钥" });
      return;
    }
    if (!parsed) {
      setError({ field: "secret", message: "密钥格式不正确 (需要 Base32 编码)" });
      return;
    }

    onAdd({
      issuer: "",
      type,
      digits: 6,
      period: 30,
      counter: 0,
      algorithm: "SHA-1",
      ...account,
      name: trimmedName,
      secret: parsed.secret,
    });
  }, [name, secret, type, importedAccount, onAdd]);

  return (
    <div className="slide-in flex flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <button
          onClick={onCancel}
          className="icon-control rounded-lg p-2 text-fg-muted"
          aria-label="返回"
        >
          <ArrowLeft size={17} />
        </button>
        <h2 className="flex-1 text-[15px] font-serif font-semibold tracking-tight text-fg">
          添加账户
        </h2>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2">
        {/* Quick import section */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClipboardImport}
            className="flex flex-1 items-center gap-2.5 rounded-cell border bg-surface px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover active:bg-surface-active"
          >
            <ClipboardPaste size={17} className="shrink-0 text-accent" />
            <div className="min-w-0">
              <span className="block text-[12.5px] font-medium text-fg">
                从剪贴板导入
              </span>
              <span className="block text-[11px] text-fg-faint">
                文本链接 / 二维码图片
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={handleScreenCapture}
            className="flex flex-1 items-center gap-2.5 rounded-cell border bg-surface px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover active:bg-surface-active"
          >
            <ScanLine size={17} className="shrink-0 text-accent" />
            <div className="min-w-0">
              <span className="block text-[12.5px] font-medium text-fg">
                屏幕扫码
              </span>
              <span className="block text-[11px] text-fg-faint">
                截取屏幕二维码
              </span>
            </div>
          </button>
        </div>

        {importError && (
          <p role="alert" aria-live="polite" className="fade-in rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-timer-low">
            {importError}
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] text-fg-faint">手动输入</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Manual form */}
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div>
            <label htmlFor="account-name" className="mb-1.5 block text-[12px] font-medium text-fg-muted">
              账户名称
            </label>
            <Input
              type="text"
              id="account-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="例如 GitHub, Google"
              aria-invalid={error?.field === "name"}
              aria-describedby={error?.field === "name" ? "account-name-error" : undefined}
            />
            {error?.field === "name" && (
              <p id="account-name-error" role="alert" className="fade-in mt-1.5 text-[12px] text-timer-low">
                {error.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="account-secret" className="mb-1.5 block text-[12px] font-medium text-fg-muted">
              密钥
            </label>
            <Input
              type="text"
              id="account-secret"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                setImportedAccount(null);
                setError(null);
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (parseSecretInput(text)) {
                  e.preventDefault();
                  handleSecretInput(text);
                }
              }}
              onBlur={() => {
                const parsed = parseSecretInput(secret);
                if (parsed && parsed.secret !== secret) handleSecretInput(secret);
              }}
              placeholder="例如 JBSWY3DPEHPK3PXP"
              className="font-mono tracking-wider"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error?.field === "secret"}
              aria-describedby={error?.field === "secret" ? "account-secret-error" : undefined}
            />
            {error?.field === "secret" && (
              <p id="account-secret-error" role="alert" className="fade-in mt-1.5 text-[12px] text-timer-low">
                {error.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-fg-muted">
              类型
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setType("totp")}
                type="button"
                aria-pressed={type === "totp"}
                className={`flex flex-1 items-center gap-2 rounded-cell border px-3.5 py-2.5 text-[12.5px] font-medium transition-colors ${
                  type === "totp"
                    ? "border-accent-border bg-accent-subtle text-accent"
                    : "bg-surface text-fg-muted hover:bg-surface-hover active:bg-surface-active"
                }`}
              >
                <Clock size={15} />
                基于时间 (TOTP)
              </button>
              <button
                onClick={() => setType("hotp")}
                type="button"
                aria-pressed={type === "hotp"}
                className={`flex flex-1 items-center gap-2 rounded-cell border px-3.5 py-2.5 text-[12.5px] font-medium transition-colors ${
                  type === "hotp"
                    ? "border-accent-border bg-accent-subtle text-accent"
                    : "bg-surface text-fg-muted hover:bg-surface-hover active:bg-surface-active"
                }`}
              >
                <Hash size={15} />
                基于计数器 (HOTP)
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="primary-control mt-1 rounded-cell bg-accent py-2.5 text-[13px] font-medium text-accent-fg active:scale-[0.98]"
          >
            保存
          </button>
        </form>
      </div>
    </div>
  );
}
