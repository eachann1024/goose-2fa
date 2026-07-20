import { useState, useRef, useEffect, type ReactNode } from "react";
import { Search, Plus, X, MoreHorizontal, Moon, Sun, ArrowDownUp, Trash2, Lock, LockOpen, LayoutGrid, List, Columns3, Sparkles } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group";
import type { ViewMode } from "@/stores/useAccounts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  hasAccounts: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onToggleView: () => void;
  onAdd: () => void;
  onManageData: () => void;
  onTrash: () => void;
  isDark: boolean;
  isThemeLocked: boolean;
  onToggleDark: () => void;
  onToggleThemeLock: () => void;
  ambientEnabled: boolean;
  onToggleAmbient: () => void;
  trashCount: number;
}

export function Header({
  hasAccounts,
  searchQuery,
  onSearchChange,
  viewMode,
  onToggleView,
  onAdd,
  onManageData,
  onTrash,
  isDark,
  isThemeLocked,
  onToggleDark,
  onToggleThemeLock,
  ambientEnabled,
  onToggleAmbient,
  trashCount,
}: HeaderProps) {
  const VIEW_CYCLE: Record<ViewMode, ViewMode> = {
    compact: "grid",
    grid: "list",
    list: "compact",
  };

  const VIEW_LABELS: Record<ViewMode, string> = {
    compact: "紧凑三列视图",
    grid: "双列网格视图",
    list: "列表视图",
  };

  const VIEW_ICONS: Record<ViewMode, ReactNode> = {
    compact: <Columns3 size={17} />,
    grid: <LayoutGrid size={17} />,
    list: <List size={17} />,
  };

  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  // 外部灌入搜索词（如 uTools quick 进入带关键字）时自动展开搜索框，
  // 让用户看到当前过滤条件、也能一键清除。
  useEffect(() => {
    if (searchQuery) setSearching(true);
  }, [searchQuery]);

  const handleSearchToggle = () => {
    if (searching) {
      setSearching(false);
      onSearchChange("");
    } else {
      setSearching(true);
    }
  };

  return (
    <header className="flex h-[57px] shrink-0 items-center gap-2 px-4">
      {searching ? (
        <InputGroup className="flex-1 h-[33px]">
          <InputGroupAddon>
            <Search size={14} className="text-fg-faint" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            aria-label="搜索账户"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索账户..."
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={handleSearchToggle}
              size="icon-xs"
              variant="ghost"
              aria-label="清除并关闭搜索"
              className="text-fg-faint shadow-none hover:bg-transparent hover:text-fg-muted"
            >
              <X size={13} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <>
          <h1 className="flex-1 text-[15px] font-serif font-semibold tracking-tight text-fg">
            验证码
          </h1>
          {hasAccounts && (
            <>
              <button
                onClick={onToggleView}
                className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
                aria-label={`当前${VIEW_LABELS[viewMode]}，点击切换`}
                title={VIEW_LABELS[VIEW_CYCLE[viewMode]]}
              >
                {VIEW_ICONS[viewMode]}
              </button>
              <button
                onClick={handleSearchToggle}
                className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
                aria-label="搜索"
              >
                <Search size={17} />
              </button>
            </>
          )}
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          aria-label="菜单"
        >
          <MoreHorizontal size={17} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onManageData} className="gap-2.5 text-[13px]">
            <ArrowDownUp size={14} />
            导入 / 导出
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTrash} className="gap-2.5 text-[13px]">
            <Trash2 size={14} />
            回收站
            {trashCount > 0 && (
              <span className="ml-auto rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-timer-low">
                {trashCount}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onToggleDark}
            className="gap-2.5 text-[13px]"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? "切换到浅色模式" : "切换到深色模式"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onToggleThemeLock}
            className="gap-2.5 text-[13px]"
          >
            {isThemeLocked ? <Lock size={14} /> : <LockOpen size={14} />}
            {isThemeLocked ? "改为跟随系统" : "锁定当前主题"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onToggleAmbient}
            className="gap-2.5 text-[13px]"
          >
            <Sparkles size={14} />
            {ambientEnabled ? "关闭背景氛围" : "开启背景氛围"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={onAdd}
        className="rounded-lg bg-accent p-2 text-accent-fg transition-colors hover:bg-accent-hover active:scale-95"
        aria-label="添加账户"
      >
        <Plus size={17} strokeWidth={2.5} />
      </button>
    </header>
  );
}
