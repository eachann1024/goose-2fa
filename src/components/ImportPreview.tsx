import { ArrowLeft } from "lucide-react";
import type { NewAccountInput } from "@/lib/types";

interface ImportPreviewProps {
  accounts: NewAccountInput[];
  duplicates: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportPreview({ accounts, duplicates, onCancel, onConfirm }: ImportPreviewProps) {
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
          确认导入
        </h2>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2">
        <div className="rounded-cell border bg-surface px-4 py-3">
          <p className="text-[13px] text-fg">
            发现 <span className="font-semibold">{accounts.length}</span> 个新账户
            {duplicates > 0 && (
              <span className="text-fg-faint">
                {" "}({duplicates} 个重复已跳过)
              </span>
            )}
          </p>
        </div>

        <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
          {accounts.map((a, i) => (
            <div
              key={i}
              className="cell-enter flex items-center gap-3 rounded-cell px-3.5 py-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-[11px] font-semibold uppercase text-accent">
                {(a.issuer || a.name).slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">
                  {a.issuer || a.name}
                </p>
                {a.issuer && (
                  <p className="truncate text-[11px] text-fg-faint">{a.name}</p>
                )}
              </div>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-fg-faint">
                {a.type}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pb-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-cell border py-2.5 text-[13px] font-medium text-fg-muted transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="primary-control flex flex-1 items-center justify-center gap-1.5 rounded-cell bg-accent py-2.5 text-[13px] font-medium text-accent-fg active:scale-[0.98]"
          >
            导入 {accounts.length} 个账户
          </button>
        </div>
      </div>
    </div>
  );
}
