import * as React from "react"
import {
  Tooltip as HeroTooltip,
  TooltipContent as HeroTooltipContent,
  TooltipTrigger as HeroTooltipTrigger,
} from "@heroui/react"

import { cn } from "@/lib/utils"

/**
 * HeroUI v3 Tooltip(基于 react-aria-components)封装。
 * 保持与原 base-ui 版相同的导出名与 props 形态:
 *   TooltipProvider(delay) / Tooltip / TooltipTrigger(render=元素) / TooltipContent
 *
 * 说明:react-aria 的延迟是 per-trigger,没有全局 Provider。
 * 这里用 Context 把 TooltipProvider 的 delay 透传到每个 Tooltip,行为等价。
 * 兼容旧 base-ui 调用面:TooltipContent 仍接受(并忽略)side/align/sideOffset/
 * alignOffset 等定位 props(HeroUI 用 placement,本项目业务未用方向定位)。
 */

const TooltipDelayContext = React.createContext<{
  delay?: number
  closeDelay?: number
}>({})

function TooltipProvider({
  delay = 0,
  closeDelay,
  children,
}: {
  delay?: number
  closeDelay?: number
  children?: React.ReactNode
}) {
  const value = React.useMemo(() => ({ delay, closeDelay }), [delay, closeDelay])
  return (
    <TooltipDelayContext.Provider value={value}>
      {children}
    </TooltipDelayContext.Provider>
  )
}

type TooltipProps = React.ComponentProps<typeof HeroTooltip>

function Tooltip(props: TooltipProps) {
  const ctx = React.useContext(TooltipDelayContext)
  const { delay, closeDelay, ...rest } = props
  return (
    <HeroTooltip
      data-slot="tooltip"
      delay={delay ?? ctx.delay}
      closeDelay={closeDelay ?? ctx.closeDelay}
      {...rest}
    />
  )
}

/**
 * TooltipTrigger:兼容 base-ui 的 `render={<element/>}`(传入 JSX 元素)用法。
 * HeroUI/react-aria 的 render 是函数签名,这里做适配:
 * 把传入的元素克隆并合并 react-aria 注入的 DOM props/ref。
 * 也容忍 render 为函数(部分 shadcn 组件如 sidebar 透传)。
 */
type TooltipTriggerProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: React.ReactElement | ((...args: any[]) => React.ReactElement)
  children?: React.ReactNode
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") ref(node)
      else (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

function TooltipTrigger({ render, children, ...props }: TooltipTriggerProps) {
  if (render && React.isValidElement(render)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = render as React.ReactElement<any>
    return (
      <HeroTooltipTrigger
        {...props}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render={(domProps: any) => {
          const elProps = element.props as Record<string, unknown>
          // react-aria 通过 domProps 注入 ref / ARIA / 事件处理,必须保留;
          // 同时合并元素自身的 ref 与 className,事件做链式调用。
          return React.cloneElement(element, {
            ...domProps,
            ...elProps,
            // React 19: ref 是普通 prop,从 element.props.ref 读取
            ref: mergeRefs(
              domProps.ref,
              elProps.ref as React.Ref<unknown> | undefined
            ),
            className: cn(
              domProps.className as string | undefined,
              elProps.className as string | undefined
            ),
          })
        }}
      />
    )
  }
  if (typeof render === "function") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <HeroTooltipTrigger {...props} render={render as any} />
  }
  return <HeroTooltipTrigger {...props}>{children}</HeroTooltipTrigger>
}

type TooltipContentProps = Omit<
  React.ComponentProps<typeof HeroTooltipContent>,
  "placement"
> & {
  // 兼容旧 base-ui 定位 props(忽略,仅为不破坏调用面)
  side?: string
  sideOffset?: number
  align?: string
  alignOffset?: number
  hidden?: boolean
}

function TooltipContent({
  className,
  children,
  side: _side,
  sideOffset: _sideOffset,
  align: _align,
  alignOffset: _alignOffset,
  hidden: _hidden,
  ...props
}: TooltipContentProps) {
  return (
    <HeroTooltipContent
      data-slot="tooltip-content"
      className={cn(
        "z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background",
        className
      )}
      {...props}
    >
      {children}
    </HeroTooltipContent>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
