import { X } from "lucide-react";

interface BatchToolbarProps {
  total: number;
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onExit: () => void;
}

/** 批量管理顶栏：退出、已选计数、全选/取消全选。 */
export function BatchToolbar({
  total,
  selectedCount,
  allSelected,
  onToggleAll,
  onExit,
}: BatchToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2 pt-3">
      <button
        type="button"
        onClick={onExit}
        className="icon-control rounded-lg p-1.5 text-fg-muted"
        aria-label="退出批量管理"
      >
        <X size={16} />
      </button>
      <span className="text-[12.5px] text-fg-muted" aria-live="polite">
        已选 <span className="font-semibold text-accent">{selectedCount}</span>
        <span className="text-fg-faint"> / {total}</span>
      </span>
      <button
        type="button"
        onClick={onToggleAll}
        className="ml-auto rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
      >
        {allSelected ? "取消全选" : "全选"}
      </button>
    </div>
  );
}
