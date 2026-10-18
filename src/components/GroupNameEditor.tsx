import type { Ref } from "react";
import { Check, FolderPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MAX_GROUP_NAME_LENGTH } from "@/lib/groups";

interface GroupNameEditorProps {
  inputRef: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  creating?: boolean;
}

export function GroupNameEditor({ inputRef, value, onChange, onSubmit, onCancel, creating = false }: GroupNameEditorProps) {
  return (
    <form
      className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-transparent bg-input px-2 transition-colors focus-within:border-accent"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {creating && <FolderPlus size={12} className="text-fg-faint" />}
      <Input
        ref={inputRef}
        variant="embedded"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) {
            if (event.key === "Enter") event.preventDefault();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        placeholder={creating ? "分组名" : undefined}
        className="w-[72px] text-[11px]"
        maxLength={MAX_GROUP_NAME_LENGTH}
        aria-label={creating ? "新建分组名称" : "重命名分组"}
      />
      <button type="submit" className="rounded-full p-0.5 text-accent transition-colors hover:bg-accent-subtle active:bg-surface-active" aria-label={creating ? "创建分组" : "确认重命名"}>
        <Check size={12} />
      </button>
      <button type="button" onClick={onCancel} className="rounded-full p-0.5 text-fg-faint transition-colors hover:bg-surface-hover active:bg-surface-active" aria-label={creating ? "取消创建" : "取消重命名"}>
        <X size={12} />
      </button>
    </form>
  );
}
