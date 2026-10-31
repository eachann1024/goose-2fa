import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Pencil, Trash2 } from "lucide-react";
import { DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";

interface GroupContextMenuProps {
  name: string;
  disabled: boolean;
  onRename: () => void;
  onDelete: () => void;
  children: ReactNode;
}

const ITEM = "gap-2.5 px-2 py-2 text-[13px] data-highlighted:bg-accent-subtle data-highlighted:text-accent";

export function GroupContextMenu({ name, disabled, onRename, onDelete, children }: GroupContextMenuProps) {
  const triggerRef = useRef<HTMLDivElement>(null);

  function handleKeyboardMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true, cancelable: true, clientX: rect.left + 12, clientY: rect.top + 12,
    }));
  }

  return (
    <ContextMenu.Root disabled={disabled}>
      <ContextMenu.Trigger ref={triggerRef} className="contents" onKeyDown={handleKeyboardMenu}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="isolate z-50 outline-none" sideOffset={4} collisionPadding={8}>
          <ContextMenu.Popup
            aria-label={`${name} 分组菜单`}
            className="max-h-(--available-height) w-36 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none"
            finalFocus={() => triggerRef.current?.querySelector("button") ?? false}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem className={ITEM} onClick={onRename}>
              <Pencil />重命名
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className={`${ITEM} text-timer-low data-highlighted:bg-danger-soft data-highlighted:text-timer-low`}
              onClick={onDelete}
            >
              <Trash2 />删除分组
            </DropdownMenuItem>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
