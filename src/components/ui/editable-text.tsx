import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  label: string;
  placeholder?: string;
  onSave: (value: string) => void;
  variant?: "heading" | "default";
  selectOnFocus?: boolean;
}

export function EditableText({ value, label, placeholder, onSave, variant = "default", selectOnFocus = false }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const heading = variant === "heading";

  return (
    <div className="group relative">
      {/* 显示和编辑复用同一个 input，避免切换元素时文字基线或尺寸变化。 */}
      <Input
        aria-label={label}
        value={editing ? draft : value}
        placeholder={placeholder}
        title={editing ? undefined : value}
        autoComplete="off"
        className={cn(
          "py-0 pr-9",
          heading ? "h-[44px] text-[18px] font-semibold" : "h-[32px] text-[12.5px] text-fg-muted",
        )}
        onFocus={(event) => {
          cancelled.current = false;
          setDraft(value);
          setEditing(true);
          if (selectOnFocus) event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          setEditing(false);
          if (!cancelled.current && draft.trim() !== value) onSave(draft.trim());
          cancelled.current = false;
          event.currentTarget.scrollLeft = 0;
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Escape") cancelled.current = true;
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <Pencil
        size={heading ? 13 : 11}
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-faint transition-colors group-hover:text-fg-muted group-focus-within:opacity-0"
      />
    </div>
  );
}
