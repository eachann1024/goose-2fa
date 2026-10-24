import { useDroppable } from "@dnd-kit/core";
import { UNGROUPED_KEY } from "@/lib/groups";

export function SegmentChip({
  label,
  count,
  active,
  onClick,
  muted,
  dropEnabled = false,
  dropGroupId,
  hasMenu = false,
  hot = false,
  lifted = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
  dropEnabled?: boolean;
  dropGroupId?: string | null;
  hasMenu?: boolean;
  hot?: boolean;
  lifted?: boolean;
}) {
  const isDropTarget = dropGroupId !== undefined;
  const { isOver, setNodeRef } = useDroppable({
    id: isDropTarget ? `group-drop:${dropGroupId ?? UNGROUPED_KEY}` : `group-drop-disabled:${label}`,
    disabled: !isDropTarget || !dropEnabled,
    data: { type: "group", groupId: dropGroupId ?? null },
  });
  const showHot = !lifted && (hot || isOver);

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      tabIndex={active ? 0 : -1}
      aria-selected={active}
      aria-label={`${label} ${count}`}
      title={label}
      data-active={active ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
        const current = tabs.indexOf(event.currentTarget);
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[nextIndex]?.focus();
        tabs[nextIndex]?.click();
      }}
      className={`group/chip flex h-7 shrink-0 items-center gap-1.5 rounded-full text-left ${
        lifted ? "transition-none" : "transition-[color,background-color,box-shadow,transform,padding]"
      } ${
        // 默认与「全部」同宽；仅悬停/菜单聚焦时略扩右侧给「…」
        hasMenu
          ? lifted
            ? "pl-3.5 pr-6"
            : "pl-3.5 pr-3.5 group-hover/seg:pr-6 group-focus-within/seg:pr-6"
          : "px-3.5"
      } ${
        lifted
          ? "bg-accent text-accent-fg"
          : showHot
            ? "scale-[1.04] bg-accent text-accent-fg shadow-[0_0_0_2px_var(--color-bg),0_0_0_4px_var(--color-accent)]"
            : active
              ? "bg-accent-subtle text-accent"
              : muted
                ? "text-fg-faint hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
                : "text-fg-muted hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle"
      }`}
    >
      <span className="max-w-[7rem] truncate text-[11.5px] font-medium leading-none">
        {label}
      </span>
      <span
        className={`tabular-nums text-[10px] leading-none ${
          lifted ? "text-accent-fg/80" : active ? "text-accent" : "text-fg-faint"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
