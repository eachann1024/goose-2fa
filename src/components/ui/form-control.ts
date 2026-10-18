import { cva } from "class-variance-authority";

// 所有状态保留 1px 边框，仅改变颜色，复合控件的内层也不移除边框。
export const formControlVariants = cva(
  "w-full min-w-0 border border-transparent text-[13px] text-fg outline-none transition-[background-color,border-color,box-shadow] placeholder:text-fg-faint disabled:cursor-not-allowed disabled:text-fg-faint disabled:opacity-100",
  {
    variants: {
      variant: {
        default: "rounded-cell bg-input px-3.5 py-2.5 hover:border-border-strong hover:shadow-sm focus:border-accent focus:shadow-sm disabled:border-border-soft disabled:bg-surface-hover aria-invalid:border-destructive",
        embedded: "rounded-none bg-transparent p-0 shadow-none hover:border-transparent hover:shadow-none focus:border-transparent focus:shadow-none disabled:bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
