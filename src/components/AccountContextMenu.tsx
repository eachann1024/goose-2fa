import { useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Copy, FolderInput, Info, Trash2 } from "lucide-react";
import { DEFAULT_GROUP_NAME, UNGROUPED_KEY } from "@/lib/groups";
import type { AccountData } from "@/lib/types";
import { useAccounts } from "@/stores/useAccounts";
import { canEditVault } from "@/stores/accounts/write-guard";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./ui/dropdown-menu";

interface AccountContextMenuProps {
  account: AccountData;
  disabled: boolean;
  onCopy: () => Promise<void>;
  onDetail: (account: AccountData) => void;
  children: ReactNode;
}

const ITEM = "gap-2.5 px-2 py-2 text-[13px] data-highlighted:bg-accent-subtle data-highlighted:text-accent";

export function AccountContextMenu({
  account, disabled, onCopy, onDetail, children,
}: AccountContextMenuProps) {
  const groups = useAccounts((state) => state.groups);
  const editable = useAccounts(canEditVault);
  const moveToGroup = useAccounts((state) => state.updateAccountGroup);
  const removeAccount = useAccounts((state) => state.removeAccount);
  const triggerRef = useRef<HTMLDivElement>(null);
  const pendingDetail = useRef(false);
  const destinations = useMemo(() => [
    { id: UNGROUPED_KEY, name: DEFAULT_GROUP_NAME },
    ...[...groups].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh")),
  ], [groups]);
  const currentGroup = account.groupId ?? UNGROUPED_KEY;

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
    <ContextMenu.Root
      disabled={disabled}
      onOpenChangeComplete={(open) => {
        if (!open && pendingDetail.current) {
          pendingDetail.current = false;
          triggerRef.current?.querySelector("button")?.focus();
          onDetail(account);
        }
      }}
    >
      <ContextMenu.Trigger ref={triggerRef} className="contents" onKeyDown={handleKeyboardMenu}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="isolate z-50 outline-none" sideOffset={4} collisionPadding={8}>
          <ContextMenu.Popup
            aria-label={`${account.note || account.issuer || account.name} 的操作`}
            className="max-h-(--available-height) w-48 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none"
            finalFocus={() => triggerRef.current?.querySelector("button") ?? false}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem className={ITEM} onClick={() => void onCopy()}>
              <Copy />复制验证码
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} onClick={() => { pendingDetail.current = true; }}>
              <Info />查看详情
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={!editable} className={`${ITEM} data-disabled:opacity-50`}>
                <FolderInput />移动到分组
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-36 max-w-[calc(100vw-16px)]" sideOffset={4}>
                <DropdownMenuRadioGroup
                  value={currentGroup}
                  onValueChange={(value) => moveToGroup(account.id, value === UNGROUPED_KEY ? null : value)}
                >
                  {destinations.map((group) => (
                    <DropdownMenuRadioItem
                      key={group.id}
                      value={group.id}
                      disabled={!editable || group.id === currentGroup}
                      className={`${ITEM} max-w-64 pr-8`}
                    >
                      <span className="truncate">{group.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!editable}
              variant="destructive"
              className={`${ITEM} text-timer-low data-highlighted:bg-danger-soft data-highlighted:text-timer-low`}
              onClick={() => removeAccount(account.id)}
            >
              <Trash2 />移到回收站
            </DropdownMenuItem>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
