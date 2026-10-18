import * as React from"react"

import { cn } from"@/lib/utils"
import { formControlVariants } from "@/components/ui/form-control"
import type { VariantProps } from "class-variance-authority"

function Textarea({ className, variant, ...props }: React.ComponentProps<"textarea"> & VariantProps<typeof formControlVariants>) {
 return (
 <textarea
 data-slot="textarea"
 className={cn(
 formControlVariants({ variant }),
 "flex field-sizing-content min-h-16",
 className
 )}
 {...props}
 />
 )
}

export { Textarea }
