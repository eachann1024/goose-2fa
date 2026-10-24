import { ArrowLeft, Download, Upload, Check, Copy, FileUp } from "lucide-react";

interface TransferMenuProps {
  accountCount: number;
  copied: boolean;
  exported: boolean;
  error: string;
  onCancel: () => void;
  onExportFile: () => void;
  onCopyUris: () => void;
  onOpenFile: () => void;
  onClipboardImport: () => void;
}

export function TransferMenu({
  accountCount,
  copied,
  exported,
  error,
  onCancel,
  onExportFile,
  onCopyUris,
  onOpenFile,
  onClipboardImport,
}: TransferMenuProps) {
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
          数据管理
        </h2>
      </div>

      <div className="flex flex-col gap-6 px-4 pt-3">
        {/* Export */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Download size={15} className="text-accent" />
            <h3 className="text-[13px] font-semibold text-fg">导出备份</h3>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-fg-muted">
            将{accountCount > 0 ? ` ${accountCount} 个` : "所有"}账户保存为备份
          </p>
          <p className="mb-3 rounded-lg bg-surface-hover px-3 py-2 text-[11.5px] leading-relaxed text-fg-muted">
            备份与 OTP 链接包含可生成验证码的密钥，请只保存到可信位置。
          </p>
          <div className="flex gap-2">
            <button
              onClick={onExportFile}
              disabled={accountCount === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-cell border bg-surface py-2.5 text-[12.5px] font-medium text-fg transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle disabled:cursor-not-allowed disabled:border-border-soft disabled:bg-surface-hover disabled:text-fg-faint disabled:opacity-100"
            >
              {exported ? (
                <>
                  <Check size={14} className="text-copied" />
                  <span className="text-copied">已保存</span>
                </>
              ) : (
                <>
                  <FileUp size={14} />
                  保存文件
                </>
              )}
            </button>
            <button
              onClick={onCopyUris}
              disabled={accountCount === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-cell border bg-surface py-2.5 text-[12.5px] font-medium text-fg transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle disabled:cursor-not-allowed disabled:border-border-soft disabled:bg-surface-hover disabled:text-fg-faint disabled:opacity-100"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-copied" />
                  <span className="text-copied">已复制</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  复制链接
                </>
              )}
            </button>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Import */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Upload size={15} className="text-accent" />
            <h3 className="text-[13px] font-semibold text-fg">导入数据</h3>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-fg-muted">
            从 JSON 备份或 otpauth:// 链接恢复账户
          </p>
          <div className="flex gap-2">
            <button
              onClick={onOpenFile}
              className="flex flex-1 items-center justify-center gap-2 rounded-cell border bg-surface py-2.5 text-[12.5px] font-medium text-fg transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
            >
              <FileUp size={14} />
              选择文件
            </button>
            <button
              onClick={onClipboardImport}
              className="flex flex-1 items-center justify-center gap-2 rounded-cell border bg-surface py-2.5 text-[12.5px] font-medium text-fg transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
            >
              <Copy size={14} />
              从剪贴板
            </button>
          </div>
        </section>

        {error && (
          <p role="alert" className="fade-in rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-timer-low">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
