import { Check } from "lucide-react";

interface ImportDoneProps {
  count: number;
  onDone: () => void;
}

export function ImportDone({ count, onDone }: ImportDoneProps) {
  return (
    <div className="slide-in flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-copied-subtle">
        <Check size={28} className="text-copied" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h2 className="text-[15px] font-medium text-fg">
          导入完成
        </h2>
        <p className="mt-1 text-[13px] text-fg-muted">
          已成功导入 {count} 个账户
        </p>
      </div>
      <button
        onClick={onDone}
        className="primary-control mt-2 rounded-cell bg-accent px-5 py-2.5 text-[13px] font-medium text-accent-fg active:scale-[0.97]"
      >
        完成
      </button>
    </div>
  );
}
