import * as React from "react"
import {
  Dropdown as HeroDropdown,
  Separator as HeroSeparator,
} from "@heroui/react"
import { Header as MenuHeaderPrimitive } from "react-aria-components/Menu"
import { ChevronRightIcon, CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * HeroUI v3 Dropdown(基于 react-aria-components)封装。
 * 保持与原 shadcn/base-ui 版相同的导出名与 props 形态,使 Header 等业务组件
 * 的 import 路径与用法不变。
 *
 * 关键映射:
 *   DropdownMenu        → Dropdown(Root, = react-aria MenuTrigger)
 *   DropdownMenuTrigger → Dropdown.Trigger(react-aria Button)
 *   DropdownMenuContent → Dropdown.Popover > Dropdown.Menu(react-aria 是 collection)
 *   DropdownMenuItem    → Dropdown.Item;item 的 onClick 映射为 react-aria 的 onAction
 *   DropdownMenuSeparator → @heroui/react Separator(与 Menu 同一 collection 实例)
 *   align="end"/side    → Popover 的 placement
 * 珊瑚橙 token、圆角、阴影等视觉保持不变。
 */

/* ----------------------------- align/side → placement ---------------------- */

function toPlacement(
  side: string | undefined,
  align: string | undefined
): string {
  const s = side ?? "bottom"
  const a = align ?? "start"
  const cross = a === "end" ? "end" : a === "center" ? "" : "start"
  return cross ? `${s} ${cross}` : s
}

/* --------------------------------- Root ------------------------------------ */

type DropdownMenuProps = {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  return (
    <HeroDropdown
      data-slot="dropdown-menu"
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </HeroDropdown>
  )
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  // react-aria 的 Popover 自带 portal,这里仅透传 children 保持 API。
  return <>{children}</>
}

/* -------------------------------- Trigger ---------------------------------- */

function DropdownMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof HeroDropdown.Trigger>) {
  return (
    <HeroDropdown.Trigger
      data-slot="dropdown-menu-trigger"
      className={className}
      {...props}
    />
  )
}

/* -------------------------------- Content ---------------------------------- */

type DropdownMenuContentProps = {
  align?: "start" | "center" | "end"
  alignOffset?: number
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  className?: string
  children?: React.ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAction?: (key: any) => void
}

function DropdownMenuContent({
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
  children,
  onAction,
  ...props
}: DropdownMenuContentProps) {
  return (
    <HeroDropdown.Popover
      data-slot="dropdown-menu-popover"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      placement={toPlacement(side, align) as any}
      offset={sideOffset}
      className={cn(
        "z-50 min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
        className
      )}
    >
      <HeroDropdown.Menu
        data-slot="dropdown-menu-content"
        className="outline-none"
        onAction={onAction}
        {...props}
      >
        {children}
      </HeroDropdown.Menu>
    </HeroDropdown.Popover>
  )
}

/* ---------------------------------- Group ---------------------------------- */

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof HeroDropdown.Section>) {
  return <HeroDropdown.Section data-slot="dropdown-menu-group" {...props} />
}

/* ---------------------------------- Label ---------------------------------- */

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuHeaderPrimitive> & { inset?: boolean }) {
  return (
    <MenuHeaderPrimitive
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className
      )}
      {...props}
    />
  )
}

/* ---------------------------------- Item ----------------------------------- */

type DropdownMenuItemProps = Omit<
  React.ComponentProps<typeof HeroDropdown.Item>,
  "onClick" | "variant" | "children"
> & {
  inset?: boolean
  variant?: "default" | "destructive"
  onClick?: (e: React.MouseEvent) => void
  children?: React.ReactNode
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  onAction,
  ...props
}: DropdownMenuItemProps) {
  return (
    <HeroDropdown.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      // react-aria 用 onAction 触发,把旧的 onClick 适配过来
      onAction={(...args) => {
        onAction?.(...args)
        onClick?.({} as React.MouseEvent)
      }}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-[focused]:bg-surface-hover data-[focused]:text-fg data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variant === "destructive" &&
          "text-destructive data-[focused]:bg-destructive/10 data-[focused]:text-destructive *:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

/* ------------------------------- Sub menu ---------------------------------- */

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof HeroDropdown.SubmenuTrigger>) {
  return <HeroDropdown.SubmenuTrigger data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<React.ComponentProps<typeof HeroDropdown.Item>, "children"> & {
  inset?: boolean
  children?: React.ReactNode
}) {
  return (
    <HeroDropdown.Item
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-[focused]:bg-surface-hover data-[focused]:text-fg data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </HeroDropdown.Item>
  )
}

function DropdownMenuSubContent({
  className,
  children,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}) {
  return (
    <HeroDropdown.Menu
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "z-50 min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none",
        className
      )}
      {...props}
    >
      {children}
    </HeroDropdown.Menu>
  )
}

/* ----------------------------- Checkbox item ------------------------------- */

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: Omit<React.ComponentProps<typeof HeroDropdown.Item>, "children"> & {
  inset?: boolean
  checked?: boolean
  children?: React.ReactNode
}) {
  return (
    <HeroDropdown.Item
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      data-checked={checked}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-[focused]:bg-surface-hover data-[focused]:text-fg data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {checked && (
        <span className="pointer-events-none absolute right-2 flex items-center justify-center">
          <CheckIcon />
        </span>
      )}
      {children}
    </HeroDropdown.Item>
  )
}

/* ------------------------------ Radio group -------------------------------- */

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof HeroDropdown.Section>) {
  return (
    <HeroDropdown.Section data-slot="dropdown-menu-radio-group" {...props} />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: Omit<React.ComponentProps<typeof HeroDropdown.Item>, "children"> & {
  inset?: boolean
  children?: React.ReactNode
}) {
  return (
    <HeroDropdown.Item
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-[focused]:bg-surface-hover data-[focused]:text-fg data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </HeroDropdown.Item>
  )
}

/* ------------------------------- Separator --------------------------------- */

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof HeroSeparator>) {
  // 必须用 @heroui/react 暴露的 Separator(HeroUI 自己的 SeparatorRoot 包装层),
  // 不能直接从 "react-aria-components/Separator" 子路径 import。子路径那份与 HeroUI
  // Dropdown/Menu 内部使用的 react-aria collection 入口不配对(运行时 ===
  // 比较为 false),会被 Menu 的 collection 解析器当成未知节点,连同其后所有兄弟项
  // 一起从 collection 里截断,导致 separator 之后的菜单项不渲染。
  // 规则:此 wrapper 内 Menu 的子节点一律走 HeroUI 同族组件,勿混用 RAC 子路径组件。
  return (
    <HeroSeparator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

/* -------------------------------- Shortcut --------------------------------- */

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
