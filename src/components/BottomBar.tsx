import { Settings, Trash2, List, Moon, Sun } from "lucide-react";

interface BottomBarProps {
  onSettings: () => void;
  onDelete: () => void;
  onManageData: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export function BottomBar({
  onSettings,
  onDelete,
  onManageData,
  isDark,
  onToggleDark,
}: BottomBarProps) {
  return (
    <footer className="mt-auto flex items-center border-t px-5 py-2.5">
      <div className="flex items-center gap-1">
        <button
          onClick={onSettings}
          className="rounded-lg p-2 text-fg-faint transition-colors hover:bg-surface hover:text-fg-muted"
          aria-label="设置"
        >
          <Settings size={18} strokeWidth={1.8} />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-fg-faint transition-colors hover:bg-surface hover:text-fg-muted"
          aria-label="删除"
        >
          <Trash2 size={18} strokeWidth={1.8} />
        </button>
        <button
          onClick={onManageData}
          className="rounded-lg p-2 text-fg-faint transition-colors hover:bg-surface hover:text-fg-muted"
          aria-label="数据管理"
        >
          <List size={18} strokeWidth={1.8} />
        </button>
      </div>
      <div className="ml-auto">
        <button
          onClick={onToggleDark}
          className="rounded-lg p-2 text-fg-faint transition-colors hover:bg-surface hover:text-fg-muted"
          aria-label={isDark ? "切换为浅色模式" : "切换为深色模式"}
        >
          {isDark ? (
            <Sun size={18} strokeWidth={1.8} />
          ) : (
            <Moon size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </footer>
  );
}
