import { DragOverlay, useDndContext } from "@dnd-kit/core";
import { CodeCellOverlay } from "./CodeCell";
import type { AccountData } from "@/lib/types";
import type { ViewMode } from "@/stores/useAccounts";

/** 分组拖动不挂浮层，芯片本身跟指针，避免浮层和原位各走各的。 */
export function AccountDragOverlay({
  account,
  viewMode,
}: {
  account: AccountData | null;
  viewMode: ViewMode;
}) {
  const { active } = useDndContext();
  if (active?.data.current?.type === "group") return null;
  return (
    <DragOverlay
      dropAnimation={{
        duration: 200,
        easing: "cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {account ? <CodeCellOverlay account={account} viewMode={viewMode} /> : null}
    </DragOverlay>
  );
}
