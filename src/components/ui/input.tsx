import * as React from "react"
import { Input as HeroInput } from "@heroui/react"

import { cn } from "@/lib/utils"

/**
 * HeroUI v3 Input(基于 react-aria-components)封装。
 * 保持与原 shadcn/base-ui 版相同的导出名(Input)与 props 形态:
 * 接受全部原生 <input> props + ref,珊瑚橙强调色样式不变。
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
    return (
      <HeroInput
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "w-full min-w-0 rounded-cell border bg-input px-3.5 py-2.5 text-[13px] text-fg transition-colors outline-none placeholder:text-fg-faint focus:border-accent/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        {...props}
      />
    )
  }
)

export { Input }
