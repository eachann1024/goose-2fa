import { useEffect, useState } from "react";
import { FolderInput, Trash2 } from "lucide-react";
import { DEFAULT_GROUP_NAME, UNGROUPED_KEY } from "@/lib/groups";
import type { VaultGroup } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface BatchActionBarProps {
  selectedCount: number;
  groups: VaultGroup[];
  onMove: (groupId: string | null) => void;
  onRemove: () => void;
}

const ITEM = "gap-2 px-2 py-1.5 text-[12.5px]";

/** 批量管理底栏：移动分组（需目标组）与移入回收站（两步确认）。 */
export function BatchActionBar({
  selectedCount,
  groups,
  onMove,
  onRemove,
}: BatchActionBarProps) {
  const [confirming, setConfirming] = useState(false);
  const disabled = selectedCount === 0;

  // 选中项变化后旧的确认态不再对应同一批账户，必须重置。
  useEffect(() => setConfirming(false), [selectedCount]);

  const destinations = [...groups].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh"),
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-3 pb-3 pt-2 backdrop-blur">
      <div className="mx-auto flex max-w-[560px] items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-cell border bg-surface py-2 text-[12.5px] font-medium text-fg transition-colors hover:border-accent hover:bg-accent-subtle hover:text-accent disabled:opacity-45"
          >
            <FolderInput size={14} />
            移动到分组
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="max-h-56 w-52">
            <DropdownMenuItem className={ITEM} onClick={() => onMove(null)}>
              <span className="truncate">{DEFAULT_GROUP_NAME}</span>
            </DropdownMenuItem>
            {destinations.map((group) => (
              <DropdownMenuItem
                key={group.id}
                className={ITEM}
                onClick={() => onMove(group.id === UNGROUPED_KEY ? null : group.id)}
              >
                <span className="truncate">{group.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {confirming ? (
          <>
            <button
              type="button"
              onClick={onRemove}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-cell bg-timer-low py-2 text-[12.5px] font-medium text-danger-fg active:scale-[0.98]"
            >
              <Trash2 size={14} />
              确认移入 {selectedCount} 项
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-cell border px-3 py-2 text-[12.5px] font-medium text-fg-muted transition-colors hover:bg-accent-subtle"
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-cell border border-danger-border bg-danger-faint py-2 text-[12.5px] font-medium text-timer-low transition-colors hover:bg-danger-soft disabled:opacity-45"
          >
            <Trash2 size={14} />
            移入回收站
          </button>
        )}
      </div>
    </div>
  );
}
