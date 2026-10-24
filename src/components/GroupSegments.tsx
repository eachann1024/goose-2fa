import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDndContext } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { GroupNameEditor } from "@/components/GroupNameEditor";
import { SegmentChip } from "@/components/SegmentChip";
import { SortableGroupChip } from "@/components/SortableGroupChip";
import { groupDndId } from "@/lib/group-drag";
import type { GroupTally } from "@/lib/groups";
import { DEFAULT_GROUP_NAME, UNGROUPED_KEY } from "@/lib/groups";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GroupSegmentsProps {
  groups: GroupTally[];
  totalCount: number;
  selected: string | null;
  dropEnabled: boolean;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => string | null;
  onRename: (id: string, name: string) => boolean;
  onDelete: (id: string) => void;
}

export function GroupSegments({
  groups,
  totalCount,
  selected,
  dropEnabled,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: GroupSegmentsProps) {
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [groupError, setGroupError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string; count: number } | null>(null);
  const createRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { active } = useDndContext();
  const sortingGroups = active?.data.current?.type === "group";

  useLayoutEffect(() => {
    if (!sortingGroups) return;
    document.documentElement.setAttribute("data-group-sorting", "");
    return () => document.documentElement.removeAttribute("data-group-sorting");
  }, [sortingGroups]);

  useEffect(() => {
    if (creating) createRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  // 选中项滚入视野
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [selected]);

  const submitCreate = () => {
    const id = onCreate(createName);
    if (id) {
      setGroupError("");
      setCreateName("");
      setCreating(false);
    } else {
      setGroupError("分组名不能为空，也不能与已有分组重复");
    }
  };

  const submitRename = () => {
    if (!renamingId) return;
    if (onRename(renamingId, renameValue)) {
      setGroupError("");
      setRenamingId(null);
      setRenameValue("");
    } else {
      setGroupError("分组名不能为空，也不能与已有分组重复");
    }
  };

  const userGroups = groups.filter((g) => g.id !== UNGROUPED_KEY);
  const ungrouped = groups.find((g) => g.id === UNGROUPED_KEY);
  const canDragGroups = userGroups.filter((g) => g.id !== renamingId).length > 1;
  const showRail = userGroups.length > 0 || creating || totalCount > 0;

  if (!showRail) return null;

  return (
    <div className="group-segments flex min-h-[45px] shrink-0 flex-col justify-center border-b border-border bg-bg py-2 pl-3">
      <div
        ref={scrollerRef}
        data-group-rail=""
        className="flex items-center gap-1 overflow-x-auto pr-[12.5rem] scrollbar-none [overflow-anchor:none] [scroll-padding-left:0.75rem] [scroll-padding-right:12.5rem]"
        role="tablist"
        aria-label="账户分组"
      >
        <SegmentChip
          label="全部"
          count={totalCount}
          active={selected === null}
          onClick={() => { setGroupError(""); onSelect(null); }}
        />

        <SortableContext
          items={userGroups.filter((g) => g.id !== renamingId).map((g) => groupDndId(g.id))}
          strategy={horizontalListSortingStrategy}
        >
          {userGroups.map((g) =>
            renamingId === g.id ? (
              <GroupNameEditor
                key={g.id}
                inputRef={renameRef}
                value={renameValue}
                onChange={(value) => { setRenameValue(value); setGroupError(""); }}
                onSubmit={submitRename}
                onCancel={() => {
                  setRenamingId(null);
                  setRenameValue("");
                  setGroupError("");
                }}
              />
            ) : (
              <SortableGroupChip key={g.id} id={g.id} canDrag={canDragGroups}>
                {({ lifted, over }) => (
                  <>
                    <SegmentChip
                      label={g.name}
                      count={g.count}
                      active={selected === g.id}
                      hot={dropEnabled && over}
                      lifted={lifted}
                      hasMenu
                      onClick={() => { setGroupError(""); onSelect(g.id); }}
                    />
                    {/* 菜单仅在悬停/聚焦时露出，不常驻占位 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="absolute right-1 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded text-fg-faint opacity-0 transition-[color,background-color,opacity] hover:bg-bg hover:text-fg focus-visible:opacity-100 group-hover/seg:opacity-100 group-focus-within/seg:opacity-100 data-[popup-open]:bg-bg data-[popup-open]:opacity-100"
                        aria-label={`${g.name} 分组菜单`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={10} strokeWidth={2} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-36">
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px]"
                          onClick={() => {
                            setGroupError("");
                            setRenamingId(g.id);
                            setRenameValue(g.name);
                          }}
                        >
                          <Pencil size={13} />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-[12.5px] text-timer-low"
                          onClick={() => setDeleteCandidate({ id: g.id, name: g.name, count: g.count })}
                        >
                          <Trash2 size={13} />
                          删除分组
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </SortableGroupChip>
            ),
          )}
        </SortableContext>

        {ungrouped && (
          <SegmentChip
            label={ungrouped.name}
            count={ungrouped.count}
            active={selected === UNGROUPED_KEY}
            dropEnabled={dropEnabled}
            dropGroupId={null}
            onClick={() => { setGroupError(""); onSelect(UNGROUPED_KEY); }}
            muted
          />
        )}

        {creating ? (
          <GroupNameEditor
            creating
            inputRef={createRef}
            value={createName}
            onChange={(value) => { setCreateName(value); setGroupError(""); }}
            onSubmit={submitCreate}
            onCancel={() => {
              setCreating(false);
              setCreateName("");
              setGroupError("");
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => { setGroupError(""); setCreating(true); }}
            className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-[11px] text-fg-muted transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-fg active:bg-surface-active"
            aria-label="新建分组"
          >
            <Plus size={12} />
            分组
          </button>
        )}
      </div>
      {groupError && (
        <p role="alert" className="mt-1.5 px-1 text-[11px] text-timer-low">{groupError}</p>
      )}
      {deleteCandidate && (
        <div role="alertdialog" aria-label="确认删除分组" className="mt-2 flex items-center gap-2 rounded-lg bg-surface-hover px-2.5 py-2">
          <p className="min-w-0 flex-1 break-words text-[11px] leading-relaxed text-fg-muted">
            删除“{deleteCandidate.name}”？{deleteCandidate.count > 0 ? `${deleteCandidate.count} 个账户会移到${DEFAULT_GROUP_NAME}。` : "此分组没有账户。"}
          </p>
          <button type="button" onClick={() => setDeleteCandidate(null)} className="min-h-8 rounded-lg px-2 text-[11px] text-fg-muted transition-colors hover:bg-surface active:bg-surface-active">取消</button>
          <button type="button" onClick={() => { onDelete(deleteCandidate.id); setDeleteCandidate(null); }} className="min-h-8 rounded-lg bg-timer-low px-2.5 text-[11px] font-medium text-danger-fg transition-[filter,transform] hover:brightness-95 active:translate-y-px active:brightness-90">删除</button>
        </div>
      )}
    </div>
  );
}
