import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
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
  const nodeRef = useRef<HTMLDivElement | null>(null);
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

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  // 按下时的宽度锁住，悬停把右侧让给菜单时不会在拖动中把整条挤偏。
  useLayoutEffect(() => {
    if (!isDragging) return;
    const rail = nodeRef.current?.closest<HTMLElement>("[data-group-rail]");
    const nodes = [...(rail?.querySelectorAll<HTMLElement>("[data-group-sortable]") ?? [])];
    const widths = nodes.map((el) => el.getBoundingClientRect().width);
    nodes.forEach((el, index) => {
      const width = `${widths[index]}px`;
      el.style.width = width;
      el.style.minWidth = width;
      el.style.maxWidth = width;
    });
    return () => {
      for (const el of nodes) {
        el.style.width = "";
        el.style.minWidth = "";
        el.style.maxWidth = "";
      }
    };
  }, [isDragging]);

  return (
    <div
      ref={setRef}
      data-group-sortable=""
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className="group/seg relative shrink-0"
      {...(canDrag ? listeners : undefined)}
    >
      {children({ lifted: isDragging, over: isOver })}
    </div>
  );
}
