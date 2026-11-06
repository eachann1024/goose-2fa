import type { ReactNode } from "react";
import { Columns3, LayoutGrid, List, Moon, Sun, Monitor } from "lucide-react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ThemeMode, ViewMode } from "@/stores/useAccounts";
import { DropdownMenuGroup, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

/**
 * 菜单图标固定 14px 槽。槽用 flex 居中，svg 用 block，
 * 换图标也不会落到文字基线上。
 */
export function MenuGlyph({
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

export const GLYPH = "size-3.5";

export const VIEW_OPTIONS: { value: ViewMode; label: string; icon: ReactNode }[] = [
  { value: "compact", label: "三列", icon: <MenuGlyph><Columns3 className={GLYPH} /></MenuGlyph> },
  { value: "grid", label: "双列", icon: <MenuGlyph><LayoutGrid className={GLYPH} /></MenuGlyph> },
  { value: "list", label: "列表", icon: <MenuGlyph scale={1.22}><List className={GLYPH} /></MenuGlyph> },
];

export const THEME_OPTIONS: { value: ThemeMode; label: string; icon: ReactNode }[] = [
  { value: "light", label: "浅色", icon: <MenuGlyph><Sun className={GLYPH} /></MenuGlyph> },
  { value: "dark", label: "深色", icon: <MenuGlyph><Moon className={GLYPH} /></MenuGlyph> },
  // 显示器主体在 24 网格里偏上且更矮，放大后把屏幕中心拉回槽位中线。
  { value: "system", label: "系统", icon: <MenuGlyph scale={1.22} nudge={10}><Monitor className={GLYPH} /></MenuGlyph> },
];

/** 菜单里的三段选择：选中不关菜单，方便连续试不同的外观。 */
export function MenuSegmented<T extends string>({
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
            className="flex h-7 min-w-0 flex-1 cursor-default items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 text-[12px] leading-none text-fg-faint outline-hidden select-none transition-colors data-highlighted:bg-accent-subtle data-highlighted:text-accent aria-checked:bg-accent-subtle aria-checked:font-medium aria-checked:text-accent"
          >
            {option.icon}
            {option.label}
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </DropdownMenuGroup>
  );
}
