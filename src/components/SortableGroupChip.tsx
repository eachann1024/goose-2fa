import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { groupDndId } from "@/lib/group-drag";

const SORT_TRANSITION = { duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };

export function SortableGroupChip({
  id,
  canDrag,
  children,
}: {
  id: string;
  canDrag: boolean;
  children: (state: { lifted: boolean; over: boolean }) => React.ReactNode;
}) {
  const data = useMemo(() => ({ type: "group" as const, groupId: id }), [id]);
  const {
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: groupDndId(id),
    disabled: { draggable: !canDrag, droppable: false },
    data,
    transition: SORT_TRANSITION,
  });

  return (
    <div
      ref={setNodeRef}
      data-group-sortable=""
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        touchAction: canDrag ? "none" : undefined,
      }}
      className="group/seg relative shrink-0"
      {...(canDrag ? listeners : undefined)}
    >
      {children({ lifted: isDragging, over: isOver })}
    </div>
  );
}
