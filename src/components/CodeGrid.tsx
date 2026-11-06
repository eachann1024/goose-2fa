import { useCallback, useEffect, useMemo } from "react";
import { DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CodeCell } from "./CodeCell";
import { AccountDragOverlay } from "./AccountDragOverlay";
import { GroupSegments } from "./GroupSegments";
import { EmptyState } from "./EmptyState";
import { BatchControls } from "./BatchControls";
import { usePlatform } from "@/platform/context";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { useAccountDrag } from "@/hooks/useAccountDrag";
import { groupAwareCollision, groupAxisModifier } from "@/lib/group-drag";
import {
  buildGroupTallies,
  filterByGroup,
  resolveSelectedGroup,
} from "@/lib/groups";
import { filterAccounts } from "@/lib/search";
import type { AccountData, VaultGroup } from "@/lib/types";
import type { ViewMode } from "@/stores/useAccounts";

interface CodeGridProps {
  accounts: AccountData[];
  groups: VaultGroup[];
  searchQuery: string;
  viewMode: ViewMode;
  selectedGroup: string | null;
  groupOrder?: string[];
  onSelectGroup: (groupId: string | null) => void;
  onCreateGroup: (name: string) => string | null;
  onRenameGroup: (id: string, name: string) => boolean;
  onDeleteGroup: (id: string) => void;
  onCopy: (text: string) => void;
  onDetail: (account: AccountData) => void;
  onIncrement: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onReorderGroups: (activeId: string, overId: string) => void;
  onMoveToGroup: (accountId: string, groupId: string | null) => void;
  onAdd: () => void;
  onClipboardImport: () => void;
  onScreenCapture: () => void;
  batchMode?: boolean;
  onExitBatch: () => void;
  onRemoveMany: (ids: string[]) => void;
  onMoveMany: (ids: string[], groupId: string | null) => void;
}

export function CodeGrid({
  accounts,
  groups,
  searchQuery,
  viewMode,
  selectedGroup,
  groupOrder,
  onSelectGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onCopy,
  onDetail,
  onIncrement,
  onReorder,
  onReorderGroups,
  onMoveToGroup,
  onAdd,
  onClipboardImport,
  onScreenCapture,
  batchMode,
  onExitBatch,
  onRemoveMany,
  onMoveMany,
}: CodeGridProps) {
  const platform = usePlatform();
  const allIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const { selectedIds, toggle, toggleAll } = useBatchSelection(Boolean(batchMode), allIds);
  const allSelected = accounts.length > 0 && selectedIds.size === accounts.length;

  const searched = useMemo(
    () => filterAccounts(accounts, searchQuery),
    [accounts, searchQuery],
  );

  const effectiveGroup = useMemo(
    () => resolveSelectedGroup(selectedGroup, groups, accounts, groupOrder),
    [selectedGroup, groups, accounts, groupOrder],
  );

  useEffect(() => {
    if (selectedGroup !== effectiveGroup) {
      onSelectGroup(effectiveGroup);
    }
  }, [selectedGroup, effectiveGroup, onSelectGroup]);

  // 一级计数基于全量；搜索时仍显示全局结构，内容区用搜索结果
  const tallies = useMemo(
    () => buildGroupTallies(groups, accounts, groupOrder),
    [groups, accounts, groupOrder],
  );

  const scoped = useMemo(() => {
    // 批量管理模式直接展示全部账户，全选即全库，方便一次清理。
    if (batchMode) return accounts;
    const base = searchQuery ? searched : filterByGroup(searched, effectiveGroup);
    return base;
  }, [searched, effectiveGroup, searchQuery, batchMode, accounts]);

  const flatIds = useMemo(
    () => scoped.map((account) => `account:${account.id}`),
    [scoped],
  );

  const sortable = !searchQuery && !batchMode;

  // 账户被外部清空时没有卡片可退出，批量模式必须自行收尾。
  useEffect(() => {
    if (batchMode && accounts.length === 0) onExitBatch();
  }, [batchMode, accounts.length, onExitBatch]);

  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await platform.copyText(text);
        onCopy(text);
        return true;
      } catch {
        return false;
      }
    },
    [onCopy, platform],
  );

  const drag = useAccountDrag({ accounts, onReorder, onReorderGroups, onMoveToGroup });

  if (accounts.length === 0) {
    return (
      <EmptyState
        onAdd={onAdd}
        onClipboardImport={onClipboardImport}
        onScreenCapture={onScreenCapture}
      />
    );
  }

  const isList = viewMode === "list";
  const isCompact = viewMode === "compact";
  const cellsClass = isList
    ? "flex flex-col gap-2"
    : isCompact
      ? "grid grid-cols-3 gap-2 max-[360px]:grid-cols-2"
      : "grid grid-cols-2 gap-3";

  const showSegments = !searchQuery && !batchMode;

  return (
    <div
      className={`relative z-[1] flex min-h-0 flex-1 flex-col ${showSegments ? "" : "pt-[45px]"}`}
      data-dragging={drag.activeId !== null ? "" : undefined}
    >
      <DndContext
        sensors={drag.sensors}
        collisionDetection={groupAwareCollision}
        modifiers={[groupAxisModifier]}
        accessibility={{ restoreFocus: false }}
        onDragStart={drag.handleDragStart}
        onDragEnd={drag.handleDragEnd}
        onDragCancel={drag.handleDragCancel}
      >
        {batchMode && (
          <BatchControls
            total={accounts.length}
            selectedCount={selectedIds.size}
            allSelected={allSelected}
            groups={groups}
            onToggleAll={toggleAll}
            onExit={onExitBatch}
            onMove={(groupId) => onMoveMany([...selectedIds], groupId)}
            onRemove={() => onRemoveMany([...selectedIds])}
          />
        )}

        {showSegments && (
          <GroupSegments
            groups={tallies}
            totalCount={accounts.length}
            selected={effectiveGroup}
            dropEnabled={drag.activeId !== null}
            onSelect={onSelectGroup}
            onCreate={onCreateGroup}
            onRename={onRenameGroup}
            onDelete={onDeleteGroup}
          />
        )}

        {searchQuery && searched.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
            <p className="text-[13px] text-fg-faint">
              未找到匹配 "{searchQuery}" 的账户
            </p>
          </div>
        ) : scoped.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-12">
            <p className="text-[13px] text-fg-muted">这个分组还是空的</p>
            <p className="text-[12px] text-fg-faint">
              添加账户，或把账户拖到上方分组
            </p>
            <button
              type="button"
              onClick={onAdd}
              className="primary-control mt-2 rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-medium text-accent-fg"
            >
              添加账户
            </button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {searchQuery && (
              <div className="sticky top-0 z-[2] border-b border-border bg-bg px-4 py-2">
                <p className="text-[11px] font-medium tracking-wide text-fg-faint">
                  搜索结果 · {scoped.length}
                </p>
              </div>
            )}

            <SortableContext
              items={flatIds}
              strategy={isList ? verticalListSortingStrategy : rectSortingStrategy}
            >
              <div className={`${cellsClass} px-4 ${batchMode ? "pb-24" : "pb-5"} pt-3`}>
                {scoped.map((account, i) => (
                  <CodeCell
                    key={account.id}
                    account={account}
                    onCopy={handleCopy}
                    onDetail={onDetail}
                    onIncrement={onIncrement}
                    index={i}
                    viewMode={viewMode}
                    sortable={sortable}
                    selectionMode={batchMode}
                    selected={selectedIds.has(account.id)}
                    onToggleSelect={toggle}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        )}

        <AccountDragOverlay account={drag.activeAccount} viewMode={viewMode} />
      </DndContext>
    </div>
  );
}
