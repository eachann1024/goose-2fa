import type { ViewMode } from "@/stores/useAccounts";

interface CellShellProps {
  viewMode: ViewMode;
  copied: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  activatorProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  activatorRef?: React.Ref<HTMLButtonElement>;
  onClick?: () => void;
  copyLabel?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export function CellShell({
  viewMode,
  copied,
  children,
  className = "",
  style,
  interactive,
  activatorProps,
  activatorRef,
  onClick,
  copyLabel,
  ref,
}: CellShellProps) {
  const isList = viewMode === "list";
  const isCompact = viewMode === "compact";
  const layout = isList
    ? "flex w-full items-center gap-3 px-3.5 py-3"
    : isCompact
      ? "flex w-full flex-col items-start p-2.5 pb-2"
      : "flex w-full flex-col items-start p-4 pb-3";
  const base = copied
    ? "copied-flash border-copied-border"
    : interactive
      ? "bg-surface hover:bg-surface-hover hover:border-border-strong " +
        (isList ? "active:scale-[0.99]" : "active:scale-[0.98]")
      : "bg-surface";

  return (
    <div
      ref={ref}
      style={style}
      className={`${className.includes("dragging-overlay") ? "" : "cell-enter"} group relative cursor-pointer rounded-cell border text-left transition-all duration-150 ${layout} ${base} ${className}`}
    >
      {interactive && (
        <button
          type="button"
          ref={activatorRef}
          {...activatorProps}
          className={`absolute inset-0 rounded-cell ${activatorProps ? "touch-none cursor-grab active:cursor-grabbing" : ""}`}
          onClick={onClick}
          aria-label={copyLabel}
        />
      )}
      <div className="cell-content contents">{children}</div>
    </div>
  );
}
