import { useEffect } from "react";
import { AlertCircle, Check } from "lucide-react";
import type { Notice } from "@/stores/accounts/store-types";

interface ToastProps {
  notice: Notice | null;
  onDismiss: () => void;
  duration?: number;
  /** 批量管理底栏占位，提示上移避免遮挡。 */
  raised?: boolean;
}

/** 单行状态提示：导入/添加的结果与异常，短暂出现，不打断取码。 */
export function Toast({ notice, onDismiss, duration = 2600, raised = false }: ToastProps) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [notice, duration, onDismiss]);

  if (!notice) return null;

  const isError = notice.tone === "error";

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${raised ? "bottom-20" : "bottom-5"}`}
      role="status"
      aria-live="polite"
    >
      <div
        key={notice.message}
        className={`toast-rise flex max-w-full items-center gap-2 rounded-full px-4 py-2 shadow-lg ${
          isError ? "bg-timer-low text-danger-fg" : "bg-accent text-accent-fg"
        }`}
      >
        {isError ? (
          <AlertCircle size={14} strokeWidth={2.5} className="shrink-0" />
        ) : (
          <Check size={14} strokeWidth={2.5} className="shrink-0" />
        )}
        <span className="truncate text-[12.5px] font-medium">{notice.message}</span>
      </div>
    </div>
  );
}
