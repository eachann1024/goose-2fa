import * as React from"react"
import { Input as InputPrimitive } from"@base-ui/react/input"

import { cn } from"@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
 function Input({ className, type, ...props }, ref) {
 return (
 <InputPrimitive
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
})

export { Input }
