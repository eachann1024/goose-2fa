import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import { Search, Plus, X, MoreHorizontal, Moon, Sun, Monitor, ArrowDownUp, Trash2, LayoutGrid, List, Columns3, MessageSquare } from "lucide-react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group";
import type { ThemeMode, ViewMode } from "@/stores/useAccounts";
import { ACCENT_OPTIONS, type AccentColor } from "@/lib/accent-color";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { UpdateNotifications } from "./UpdateNotifications";

interface HeaderProps {
  hasAccounts: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAdd: () => void;
  onManageData: () => void;
  onTrash: () => void;
  onFeedback: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  accentColor: AccentColor;
  onAccentColorChange: (accentColor: AccentColor) => void;
  trashCount: number;
}

/**
 * 菜单图标固定 14px 槽。槽用 flex 居中，svg 用 block，
 * 换图标也不会落到文字基线上。
 */
function MenuGlyph({
  children,
  scale = 1,
  nudge = 0,
}: {
  children: ReactNode;
  scale?: number;
  nudge?: number;
}) {
  const tuned = scale !== 1 || nudge !== 0;
  return (
    <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
      <span
        className="inline-flex size-full items-center justify-center [&_svg]:block [&_svg]:size-3.5"
        style={tuned ? { transform: `translateY(${nudge}%) scale(${scale})` } : undefined}
      >
        {children}
      </span>
    </span>
  );
}

const GLYPH = "size-3.5";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: ReactNode }[] = [
  { value: "compact", label: "三列", icon: <MenuGlyph><Columns3 className={GLYPH} /></MenuGlyph> },
  { value: "grid", label: "双列", icon: <MenuGlyph><LayoutGrid className={GLYPH} /></MenuGlyph> },
  { value: "list", label: "列表", icon: <MenuGlyph scale={1.22}><List className={GLYPH} /></MenuGlyph> },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: ReactNode }[] = [
  { value: "light", label: "浅色", icon: <MenuGlyph><Sun className={GLYPH} /></MenuGlyph> },
  { value: "dark", label: "深色", icon: <MenuGlyph><Moon className={GLYPH} /></MenuGlyph> },
  // 显示器主体在 24 网格里偏上且更矮，放大后把屏幕中心拉回槽位中线。
  { value: "system", label: "系统", icon: <MenuGlyph scale={1.22} nudge={10}><Monitor className={GLYPH} /></MenuGlyph> },
];

/** 菜单里的三段选择：选中不关菜单，方便连续试不同的外观。 */
function MenuSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="px-2 pt-1.5 text-[11px] font-normal text-fg-faint">{label}</DropdownMenuLabel>
      <MenuPrimitive.RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as T)}
        className="mx-1 mb-1 flex gap-0.5 rounded-lg border bg-bg p-0.5"
      >
        {options.map((option) => (
          <MenuPrimitive.RadioItem
            key={option.value}
            value={option.value}
            closeOnClick={false}
            className="flex h-7 min-w-0 flex-1 cursor-default items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 text-[12px] leading-none text-fg-faint outline-hidden select-none transition-colors data-highlighted:bg-surface-hover data-highlighted:text-fg aria-checked:bg-accent-subtle aria-checked:font-medium aria-checked:text-accent"
          >
            {option.icon}
            {option.label}
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </DropdownMenuGroup>
  );
}

export function Header({
  hasAccounts,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onAdd,
  onManageData,
  onTrash,
  onFeedback,
  themeMode,
  onThemeModeChange,
  accentColor,
  onAccentColorChange,
  trashCount,
}: HeaderProps) {
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentAccent = ACCENT_OPTIONS.find((option) => option.value === accentColor);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  // 外部灌入搜索词（如 uTools quick 进入带关键字）时自动展开搜索框，
  // 让用户看到当前过滤条件、也能一键清除。
  useEffect(() => {
    if (searchQuery) setSearching(true);
  }, [searchQuery]);

  // 账户全部删光时搜索入口随之消失，不能把展开的搜索框留在原地。
  useEffect(() => {
    if (!hasAccounts && !searchQuery) setSearching(false);
  }, [hasAccounts, searchQuery]);

  const closeSearch = () => {
    setSearching(false);
    onSearchChange("");
  };

  return (
    <header
      className={`absolute top-0 z-[4] flex h-[45px] items-center gap-1 px-4 ${
        searching ? "inset-x-0 bg-bg" : "right-0"
      }`}
    >
      <h1 className="sr-only">验证码</h1>
      {searching && (
        <InputGroup className="mr-1 h-[33px] flex-1">
          <InputGroupAddon>
            <Search size={14} className="text-fg-faint" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            aria-label="搜索账户"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Escape") {
                // 只收起搜索，不让 Esc 继续冒泡把整个插件关掉。
                e.preventDefault();
                e.stopPropagation();
                closeSearch();
              }
            }}
            placeholder="搜索账户..."
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={closeSearch}
              size="icon-xs"
              variant="ghost"
              aria-label="清除并关闭搜索"
              className="text-fg-faint shadow-none hover:bg-transparent hover:text-fg-muted"
            >
              <X size={13} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      )}

      {/* 新增是唯一的主操作，固定在按钮组最左；其余次要入口退成灰色图标。 */}
      <button
        onClick={onAdd}
        className="primary-control rounded-lg bg-accent p-2 text-accent-fg active:scale-95"
        aria-label="添加账户"
        title="添加账户"
      >
        <Plus size={17} strokeWidth={2.5} />
      </button>
      <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />

      {hasAccounts && !searching && (
        <button
          onClick={() => setSearching(true)}
          className="icon-control rounded-lg p-2 text-fg-muted"
          aria-label="搜索"
          title="搜索"
        >
          <Search size={17} />
        </button>
      )}

      <button
        onClick={onFeedback}
        className="icon-control rounded-lg p-2 text-fg-muted"
        aria-label="反馈"
        title="反馈"
        data-feedback-entry
      >
        <MessageSquare size={17} />
      </button>

      <UpdateNotifications />

      <DropdownMenu>
        <DropdownMenuTrigger
          className="icon-control rounded-lg p-2 text-fg-muted data-popup-open:bg-surface data-popup-open:text-fg"
          aria-label="更多"
          title="更多"
        >
          <MoreHorizontal size={17} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-24px)] p-1.5">
          {hasAccounts && (
            <MenuSegmented label="布局" value={viewMode} options={VIEW_OPTIONS} onChange={onViewModeChange} />
          )}
          <MenuSegmented label="外观" value={themeMode} options={THEME_OPTIONS} onChange={onThemeModeChange} />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center justify-between px-2 pt-1.5 text-[11px] font-normal text-fg-faint">
              强调色
              <span>{currentAccent?.label}</span>
            </DropdownMenuLabel>
            <MenuPrimitive.RadioGroup
              value={accentColor}
              onValueChange={(next) => onAccentColorChange(next as AccentColor)}
              className="flex justify-between px-2 pb-2 pt-1"
            >
              {ACCENT_OPTIONS.map((option) => (
                <MenuPrimitive.RadioItem
                  key={option.value}
                  value={option.value}
                  closeOnClick={false}
                  aria-label={option.label}
                  title={option.label}
                  className="group/swatch grid size-6 cursor-default place-items-center rounded-full outline-hidden"
                >
                  {/* 选中环画在色点上：菜单项聚焦时 focus-reset 会清掉自身的 box-shadow。 */}
                  <span
                    className="accent-swatch transition-shadow group-data-highlighted/swatch:shadow-[0_0_0_2px_var(--color-popover),0_0_0_4px_var(--color-border-strong)] group-aria-checked/swatch:shadow-[0_0_0_2px_var(--color-popover),0_0_0_4px_var(--color-accent)]"
                    style={{
                      "--swatch-light": option.light,
                      "--swatch-dark": option.dark,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                </MenuPrimitive.RadioItem>
              ))}
            </MenuPrimitive.RadioGroup>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManageData} className="gap-2.5 px-2 py-1.5 text-[13px]">
            <MenuGlyph><ArrowDownUp className={GLYPH} /></MenuGlyph>
            导入 / 导出
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTrash} className="gap-2.5 px-2 py-1.5 text-[13px]">
            <MenuGlyph><Trash2 className={GLYPH} /></MenuGlyph>
            回收站
            {trashCount > 0 && (
              <span className="ml-auto rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-timer-low">
                {trashCount > 99 ? "99+" : trashCount}
              </span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
