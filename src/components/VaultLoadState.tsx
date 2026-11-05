import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";

export function VaultLoadState({
  status,
  message,
  onRetry,
}: {
  status: "idle" | "loading" | "error";
  message: string | null;
  onRetry: () => Promise<void>;
}) {
  const failed = status === "error";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-8 text-center">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-cell ${
          failed ? "bg-danger-soft text-timer-low" : "bg-accent-subtle text-accent"
        }`}
        aria-hidden="true"
      >
        {failed ? <AlertCircle size={21} /> : <LoaderCircle className="animate-spin" size={21} />}
      </div>
      <h1 className="mt-4 text-[15px] font-semibold text-fg">
        {failed ? "账户读取失败" : "正在读取账户"}
      </h1>
      <p className="mt-1.5 max-w-[280px] text-[12.5px] leading-relaxed text-fg-muted" role={failed ? "alert" : undefined}>
        {failed ? message : "请稍候，加载完成前不会写入或覆盖数据。"}
      </p>
      {failed && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void onRetry()}
            className="primary-control flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[12.5px] font-medium text-accent-fg"
          >
            <RefreshCw size={13} />
            重试
          </button>
        </div>
      )}
    </main>
  );
}
