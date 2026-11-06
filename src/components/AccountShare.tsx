import { useEffect, useState } from "react";
import { Check, ClipboardPaste, Copy, Pencil, ScanLine, X } from "lucide-react";
import QRCode from "qrcode";
import { accountToOtpAuthUri } from "@/lib/data-transfer";
import { normalizeBase32Secret } from "@/lib/account-validation";
import { formatCode, generateHOTP, generateTOTP } from "@/lib/otp";
import { decodeQRFromBase64, readQRFromClipboard } from "@/lib/qr-decode";
import { parseSecretInput, parseSecretReplacement } from "@/lib/secret-input";
import type { AccountData } from "@/lib/types";
import { usePlatform } from "@/platform/context";

export type ShareMode = "qr" | "secret";

interface AccountShareProps {
  account: AccountData;
  open: ShareMode | null;
  editable?: boolean;
  onClose: () => void;
  onCopy: (text: string) => boolean | Promise<boolean>;
  onUpdateSecret?: (secretInput: string) => Promise<boolean> | boolean;
}

/** 二维码 / 密钥面板；入口按钮在详情页顶栏，这里只负责展开后的内容。 */
export function AccountShare({ account, open, editable = true, onClose, onCopy, onUpdateSecret }: AccountShareProps) {
  const platform = usePlatform();
  const uri = accountToOtpAuthUri(account);
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [draft, setDraft] = useState(account.secret);
  const [sourceInput, setSourceInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const isDirty = draft.trim() !== account.secret;
  const normalizedDraft = parseSecretInput(draft)?.secret ?? normalizeBase32Secret(draft);

  useEffect(() => {
    setDraft(account.secret);
    setSourceInput(null);
    setError(null);
    setEditing(false);
  }, [account.id, account.secret, open]);

  useEffect(() => {
    let active = true;
    setPreviewCode("");
    if (open === "secret" && isDirty && normalizedDraft) {
      const generate = account.type === "hotp"
        ? generateHOTP(normalizedDraft, account.counter, account.digits, account.algorithm)
        : generateTOTP(normalizedDraft, account.period, account.digits, account.algorithm).then((result) => result.code);
      void generate.then((code) => { if (active) setPreviewCode(code); }).catch(() => {
        if (active) setError("无法生成验证码预览，请检查密钥");
      });
    }
    return () => { active = false; };
  }, [open, isDirty, normalizedDraft, account.type, account.counter, account.period, account.digits, account.algorithm]);

  // 切换面板或账户时清掉上一次的复制反馈，避免「已复制」串到另一个面板上。
  useEffect(() => {
    setCopied(false);
    setCopyError(false);
  }, [open, uri]);

  useEffect(() => {
    if (open !== "qr") return;
    setSvg("");
    let active = true;
    void QRCode.toString(uri, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    }).then((markup) => {
      if (active) setSvg(markup);
    });
    return () => {
      active = false;
    };
  }, [open, uri]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyText = open === "secret" ? account.secret : uri;

  const copyValue = async () => {
    setCopyError(false);
    const success = await onCopy(copyText);
    if (!success) {
      setCopyError(true);
      return;
    }
    setCopied(true);
  };

  const resetDraft = () => { setDraft(account.secret); setSourceInput(null); setError(null); setEditing(false); };
  const applyContent = (content: string) => {
    const parsed = parseSecretReplacement(content);
    if (!parsed.result) return false;
    setDraft(parsed.result.secret);
    setSourceInput(content.trim());
    setError(null);
    return true;
  };
  const replaceFromClipboard = async () => {
    try {
      const text = await platform.readClipboardText();
      if (text && applyContent(text)) return;
      const qr = await readQRFromClipboard(platform);
      if (qr && applyContent(qr)) return;
      setError("剪贴板中没有有效的单账户密钥或二维码");
    } catch { setError("读取剪贴板失败，请检查权限后重试"); }
  };
  const replaceFromScreen = async () => {
    try {
      const image = await platform.captureScreen();
      if (!image) { setError("截屏已取消"); return; }
      const qr = await decodeQRFromBase64(image);
      if (!qr) { setError("未在截图中检测到二维码"); return; }
      if (!applyContent(qr)) setError("二维码不包含有效的单账户密钥");
    } catch { setError("截屏或识别二维码失败，请重试"); }
  };
  const save = async () => {
    if (!normalizedDraft) { setError("密钥格式不正确 (需要 Base32 编码)"); return; }
    setSaving(true);
    try {
      const payload = sourceInput && parseSecretReplacement(sourceInput).result?.secret === normalizedDraft ? sourceInput : draft.trim();
      if (!await onUpdateSecret?.(payload)) setError("保存失败，请检查账户状态后重试");
    } catch { setError("保存失败，请重试"); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <section className="mb-4" aria-label={open === "qr" ? "二维码" : "密钥"}>
      <div className="rounded-cell border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-fg">
            {open === "qr" ? "扫码导入" : "密钥"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="icon-control rounded-lg p-1.5 text-fg-faint"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>

        {open === "qr" ? (
          <div
            className="mx-auto aspect-square w-[220px] max-w-full overflow-hidden rounded-lg bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (<>
          <div className="group relative">
            <textarea
              aria-label="账户密钥" rows={2} value={draft} readOnly={!editable} spellCheck={false}
              autoComplete="off" placeholder="输入或粘贴 Base32 密钥"
              className={`w-full resize-none break-all rounded-lg border bg-bg px-3 py-2.5 pr-8 font-mono text-[13px] leading-relaxed tracking-wide text-fg outline-none transition-colors focus:border-accent ${error ? "border-timer-low focus:border-timer-low" : isDirty ? "border-accent" : "border-transparent hover:border-border"}`}
              onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
              onChange={(event) => { setDraft(event.target.value); setSourceInput(null); setError(null); }}
              onPaste={(event) => {
                if (!editable) return;
                const raw = event.clipboardData.getData("text");
                const parsed = parseSecretReplacement(raw).result;
                if (parsed) { event.preventDefault(); setDraft(parsed.secret); setSourceInput(raw.trim()); setError(null); }
              }}
              onKeyDown={(event) => { if (event.key === "Escape") { resetDraft(); event.currentTarget.blur(); } }}
            />
            {editable && !isDirty && !editing && <Pencil size={12} aria-hidden="true" className="pointer-events-none absolute top-3 right-3 text-fg-faint transition-opacity group-hover:text-accent group-focus-within:opacity-0" />}
          </div>
          {error && <p role="alert" className="mt-1.5 text-[12px] text-timer-low">{error}</p>}
          {editable && <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void replaceFromClipboard()} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12px] text-fg-muted hover:border-accent hover:text-accent"><ClipboardPaste size={13} className="shrink-0 text-accent" />从剪贴板替换</button>
            <button type="button" onClick={() => void replaceFromScreen()} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12px] text-fg-muted hover:border-accent hover:text-accent"><ScanLine size={13} className="shrink-0 text-accent" />屏幕扫码替换</button>
          </div>}
          {editable && isDirty && <>
            {normalizedDraft && previewCode && <div className="mt-2.5 flex items-center justify-between rounded-lg border bg-bg px-3 py-2">
              <span className="text-[11.5px] text-fg-muted">新密钥验证码预览</span>
              <span className="font-mono text-[15px] font-semibold tracking-wider text-fg" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCode(previewCode)}</span>
            </div>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={resetDraft} disabled={saving} className="h-9 rounded-lg border text-[12px] text-fg-muted hover:border-accent hover:text-accent">取消</button>
              <button type="button" onClick={() => void save()} disabled={saving} className="primary-control h-9 rounded-lg bg-accent text-[12px] font-medium text-accent-fg disabled:opacity-50">保存并复制新码</button>
            </div>
          </>}
        </>)}

        {(open === "qr" || !isDirty || !editable) && <button
          type="button"
          onClick={() => void copyValue()}
          className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[12px] text-fg-muted transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "已复制" : open === "qr" ? "复制链接" : "复制密钥"}
        </button>}
        {copyError && (
          <p role="alert" className="mt-2 text-[12px] text-timer-low">
            复制失败，请检查剪贴板权限后重试
          </p>
        )}
      </div>
    </section>
  );
}
