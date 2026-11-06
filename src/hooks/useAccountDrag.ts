import { useCallback, useState } from "react";
import {
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { HoldPointerSensor } from "@/lib/group-drag";
import { UNGROUPED_KEY } from "@/lib/groups";
import type { AccountData } from "@/lib/types";

interface AccountDragOptions {
  accounts: AccountData[];
  onReorder: (activeId: string, overId: string) => void;
  onReorderGroups: (activeId: string, overId: string) => void;
  onMoveToGroup: (accountId: string, groupId: string | null) => void;
}

/** 账户卡片与分组芯片共用的拖拽状态：按住 220ms 才启动，触屏与鼠标一致。 */
export function useAccountDrag({
  accounts,
  onReorder,
  onReorderGroups,
  onMoveToGroup,
}: AccountDragOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(HoldPointerSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (event.active.data.current?.type === "group") return;
    const accountId = event.active.data.current?.accountId;
    setActiveId(typeof accountId === "string" ? accountId : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.data.current?.type === "group") {
        const activeGroupId = active.data.current.groupId;
        const overGroupId = over?.data.current?.groupId;
        if (
          typeof activeGroupId === "string" &&
          typeof overGroupId === "string" &&
          activeGroupId !== overGroupId
        ) {
          onReorderGroups(activeGroupId, overGroupId);
        }
        return;
      }
      const accountId = active.data.current?.accountId;
      if (typeof accountId !== "string") {
        setActiveId(null);
        return;
      }
      if (over?.data.current?.type === "group") {
        const groupId = (over.data.current.groupId as string | null) ?? null;
        onMoveToGroup(accountId, groupId === UNGROUPED_KEY ? null : groupId);
      } else if (over?.data.current?.type === "account") {
        const overAccountId = over.data.current.accountId;
        if (typeof overAccountId === "string" && accountId !== overAccountId) {
          onReorder(accountId, overAccountId);
        }
      }
      setActiveId(null);
    },
    [onMoveToGroup, onReorder, onReorderGroups],
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);
  const activeAccount = activeId
    ? accounts.find((account) => account.id === activeId) ?? null
    : null;

  return { activeId, activeAccount, sensors, handleDragStart, handleDragEnd, handleDragCancel };
}
