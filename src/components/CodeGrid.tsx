import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CodeCell, CodeCellOverlay } from "./CodeCell";
import { EmptyState } from "./EmptyState";
import { usePlatform } from "@/platform/context";
import type { AccountData } from "@/lib/types";
import type { ViewMode } from "@/stores/useAccounts";

interface CodeGridProps {
  accounts: AccountData[];
  searchQuery: string;
  viewMode: ViewMode;
  onCopy: (text: string) => void;
  onDetail: (account: AccountData) => void;
  onIncrement: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onAdd: () => void;
  onClipboardImport: () => void;
  onScreenCapture: () => void;
}

export function CodeGrid({
  accounts,
  searchQuery,
  viewMode,
  onCopy,
  onDetail,
  onIncrement,
  onReorder,
  onAdd,
  onClipboardImport,
  onScreenCapture,
}: CodeGridProps) {
  const platform = usePlatform();
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = accounts.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.issuer.toLowerCase().includes(q)
    );
  });

  // 仅在未搜索时允许拖拽排序——过滤后的顺序与真实数组不一致，重排会错位。
  const sortable = !searchQuery;

  const sensors = useSensors(
    // 拖动需移动 6px 才激活，避免与点击复制冲突。
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleCopy = useCallback(
    (text: string) => {
      platform.copyText(text);
      onCopy(text);
    },
    [onCopy, platform],
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (over && active.id !== over.id) {
        onReorder(String(active.id), String(over.id));
      }
      setActiveId(null);
    },
    [onReorder],
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  const activeAccount = activeId
    ? filtered.find((a) => a.id === activeId) ?? null
    : null;

  if (accounts.length === 0) {
    return <EmptyState onAdd={onAdd} onClipboardImport={onClipboardImport} onScreenCapture={onScreenCapture} />;
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-[13px] text-fg-faint">
          未找到匹配 "{searchQuery}" 的账户
        </p>
      </div>
    );
  }

  const isList = viewMode === "list";
  const containerClass = isList
    ? "flex flex-col gap-2 px-4 pb-4"
    : "grid grid-cols-2 gap-3 px-4 pb-4";

  const cells = filtered.map((account, i) => (
    <CodeCell
      key={account.id}
      account={account}
      onCopy={handleCopy}
      onDetail={onDetail}
      onIncrement={onIncrement}
      index={i}
      viewMode={viewMode}
      sortable={sortable}
    />
  ));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={filtered.map((a) => a.id)}
        strategy={isList ? verticalListSortingStrategy : rectSortingStrategy}
      >
        <div className={containerClass}>{cells}</div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
        {activeAccount ? (
          <CodeCellOverlay account={activeAccount} viewMode={viewMode} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
