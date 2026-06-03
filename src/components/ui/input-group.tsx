"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  InputGroup as HeroInputGroupRoot,
  InputGroupInput as HeroInputGroupInput,
  InputGroupPrefix as HeroInputGroupPrefix,
  InputGroupSuffix as HeroInputGroupSuffix,
  InputGroupTextArea as HeroInputGroupTextArea,
} from "@heroui/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * HeroUI v3 InputGroup(基于 react-aria-components)封装。
 * 保持与原 shadcn 版相同的导出名与 props 形态:
 *   InputGroup / InputGroupAddon(align) / InputGroupInput / InputGroupButton /
 *   InputGroupText / InputGroupTextarea
 *
 * align="inline-start" → HeroUI Prefix(input 之前)
 * align="inline-end"   → HeroUI Suffix(input 之后)
 * block-start/block-end 退化为 Prefix/Suffix(本项目业务未用块级 addon)。
 * 容器点击聚焦由 HeroUI Root 内置实现,珊瑚橙样式 token 不变。
 */

function InputGroup({
  className,
  ...props
}: React.ComponentProps<typeof HeroInputGroupRoot>) {
  return (
    <HeroInputGroupRoot
      data-slot="input-group"
      className={cn(
        "group/input-group relative flex w-full min-w-0 items-center rounded-cell border bg-input transition-colors outline-none focus-within:border-accent/40 has-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-2 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "order-last pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "order-first w-full justify-start px-2.5 pt-2",
        "block-end":
          "order-last w-full justify-start px-2.5 pb-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  const Comp =
    align === "inline-end" || align === "block-end"
      ? HeroInputGroupSuffix
      : HeroInputGroupPrefix
  return (
    <Comp
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-[calc(var(--radius)-3px)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "",
        "icon-xs": "size-6 rounded-[calc(var(--radius)-3px)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<typeof HeroInputGroupInput>) {
  return (
    <HeroInputGroupInput
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent py-0 text-[13px] text-fg shadow-none outline-none ring-0 placeholder:text-fg-faint disabled:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<typeof HeroInputGroupTextArea>) {
  return (
    <HeroInputGroupTextArea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-2 text-[13px] text-fg shadow-none outline-none ring-0 placeholder:text-fg-faint disabled:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
