import { useState, useRef, useEffect } from "react";
import { Search, Plus, X, MoreHorizontal, Moon, Sun, ArrowDownUp, Trash2, Lock, LockOpen } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group";
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
  onAdd: () => void;
  onManageData: () => void;
  onTrash: () => void;
  isDark: boolean;
  isThemeLocked: boolean;
  onToggleDark: () => void;
  onToggleThemeLock: () => void;
  trashCount: number;
}

export function Header({
  hasAccounts,
  searchQuery,
  onSearchChange,
  onAdd,
  onManageData,
  onTrash,
  isDark,
  isThemeLocked,
  onToggleDark,
  onToggleThemeLock,
  trashCount,
}: HeaderProps) {
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

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
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索账户..."
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={handleSearchToggle}
              size="icon-xs"
              variant="ghost"
              className="text-fg-faint shadow-none hover:bg-transparent hover:text-fg-muted"
            >
              <X size={13} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <>
          <h1 className="flex-1 text-[15px] font-semibold tracking-tight text-fg">
            验证码
          </h1>
          {hasAccounts && (
            <button
              onClick={handleSearchToggle}
              className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
              aria-label="搜索"
            >
              <Search size={17} />
            </button>
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
              <span className="ml-auto rounded-full bg-timer-low/10 px-1.5 py-0.5 text-[10px] font-medium text-timer-low">
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
            {isDark ? "浅色模式" : "深色模式"}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleThemeLock(); }}
              className={[
                "ml-auto rounded p-0.5 transition-colors",
                isThemeLocked
                  ? "text-fg hover:text-fg-muted"
                  : "text-fg-faint hover:text-fg-muted",
              ].join(" ")}
              aria-label={isThemeLocked ? "解锁，跟随系统" : "锁定主题"}
            >
              {isThemeLocked ? <Lock size={12} /> : <LockOpen size={12} />}
            </button>
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
