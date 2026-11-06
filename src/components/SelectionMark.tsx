import { Check } from "lucide-react";

/** 批量选择态的圆形勾选标记，尺寸由调用方决定。 */
export function SelectionMark({
  selected,
  className = "",
}: {
  selected: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected
          ? "border-accent bg-accent text-accent-fg"
          : "border-border-strong bg-surface text-transparent"
      } ${className}`}
    >
      <Check size={13} strokeWidth={3} />
    </span>
  );
}
