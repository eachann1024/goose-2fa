import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import QRCode from "qrcode";
import { accountToOtpAuthUri } from "@/lib/data-transfer";
import type { AccountData } from "@/lib/types";

export type ShareMode = "qr" | "secret";

interface AccountShareProps {
  account: AccountData;
  open: ShareMode | null;
  onClose: () => void;
  onCopy: (text: string) => boolean | Promise<boolean>;
}

/** 二维码 / 密钥面板；入口按钮在详情页顶栏，这里只负责展开后的内容。 */
export function AccountShare({ account, open, onClose, onCopy }: AccountShareProps) {
  const uri = accountToOtpAuthUri(account);
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

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
        ) : (
          <p className="break-all rounded-lg bg-bg px-3 py-2.5 font-mono text-[13px] leading-relaxed tracking-wide text-fg">
            {account.secret}
          </p>
        )}

        <button
          type="button"
          onClick={() => void copyValue()}
          className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[12px] text-fg-muted transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "已复制" : open === "qr" ? "复制链接" : "复制密钥"}
        </button>
        {copyError && (
          <p role="alert" className="mt-2 text-[12px] text-timer-low">
            复制失败，请检查剪贴板权限后重试
          </p>
        )}
      </div>
    </section>
  );
}
