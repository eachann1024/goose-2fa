import * as React from"react"
import { Input as InputPrimitive } from"@base-ui/react/input"

import { cn } from"@/lib/utils"
import { formControlVariants } from "@/components/ui/form-control"
import type { VariantProps } from "class-variance-authority"

type InputProps = React.ComponentProps<"input"> & VariantProps<typeof formControlVariants>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
 function Input({ className, type, variant, ...props }, ref) {
 return (
 <InputPrimitive
 ref={ref}
 type={type}
 data-slot="input"
 className={cn(
 formControlVariants({ variant }),
 "disabled:pointer-events-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium",
 className
 )}
 {...props}
 />
 )
})

export { Input }
