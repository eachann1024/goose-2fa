import { Button as ButtonPrimitive } from"@base-ui/react/button"
import { cva, type VariantProps } from"class-variance-authority"

import { cn } from"@/lib/utils"

const buttonVariants = cva(
"group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
 {
 variants: {
 variant: {
default:"bg-primary text-primary-foreground hover:bg-accent-hover active:bg-accent-active",
 outline:
"border-border bg-background hover:border-accent hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle aria-expanded:bg-accent-subtle aria-expanded:text-accent dark:border-input dark:bg-input dark:hover:bg-accent-subtle",
 secondary:
"bg-secondary text-secondary-foreground hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle aria-expanded:bg-accent-subtle aria-expanded:text-accent",
 ghost:
"hover:bg-accent-subtle hover:text-accent active:bg-accent-subtle aria-expanded:bg-accent-subtle aria-expanded:text-accent dark:hover:bg-accent-subtle",
 destructive:
"bg-danger-soft text-destructive hover:bg-danger-faint active:bg-danger-soft",
 link:"text-primary underline-offset-4 hover:underline",
 },
 size: {
 default:
"h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
 xs:"h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
 sm:"h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
 lg:"h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
 icon:"size-8",
"icon-xs":
"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
"icon-sm":
"size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
"icon-lg":"size-9",
 },
 },
 defaultVariants: {
 variant:"default",
 size:"default",
 },
 }
)

function Button({
 className,
 variant ="default",
 size ="default",
 ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
 return (
 <ButtonPrimitive
 data-slot="button"
 className={cn(buttonVariants({ variant, size, className }))}
 {...props}
 />
 )
}

export { Button, buttonVariants }
