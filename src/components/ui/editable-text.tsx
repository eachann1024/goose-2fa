import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  label: string;
  placeholder?: string;
  onSave: (value: string) => void;
  variant?: "heading" | "default";
  selectOnFocus?: boolean;
  multiline?: boolean;
}

const MIN_HEIGHT = 40;
const EDGE = 16;

function viewBounds(el: HTMLElement) {
  const scroller = el.closest(".view-detail");
  if (scroller instanceof HTMLElement) {
    const rect = scroller.getBoundingClientRect();
    return { bottom: rect.bottom, height: rect.height };
  }
  return { bottom: window.innerHeight, height: window.innerHeight };
}

/** 底边停在详情可视区域内侧，高度也不超过这块区域。 */
function maxBoxHeight(el: HTMLElement, min = MIN_HEIGHT, top = el.getBoundingClientRect().top) {
  const view = viewBounds(el);
  const room = Math.floor(view.bottom - EDGE - top);
  const screenCap = Math.floor(view.height - EDGE);
  return Math.max(min, Math.min(room, screenCap));
}

export function EditableText(props: EditableTextProps) {
  if (props.multiline) return <MultilineText {...props} />;
  return <SingleLineText {...props} />;
}

function SingleLineText({ value, label, placeholder, onSave, variant = "default", selectOnFocus = false }: EditableTextProps) {
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
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-faint transition-colors group-hover:text-accent group-focus-within:opacity-0"
      />
    </div>
  );
}

function MultilineText({ value, label, placeholder, onSave, variant = "default", selectOnFocus = false }: EditableTextProps) {
  const heading = variant === "heading";
  const minHeight = heading ? 44 : MIN_HEIGHT;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const contentHeight = useRef(minHeight);
  const explicit = useRef<number | null>(null);
  const cancelled = useRef(false);
  const dragging = useRef(false);
  const [gripActive, setGripActive] = useState(false);
  const [fieldHot, setFieldHot] = useState(false);
  const [gripHot, setGripHot] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [height, setHeight] = useState(minHeight);
  const [ceiling, setCeiling] = useState(minHeight);
  const shown = editing ? draft : value;

  const publish = (top?: number) => {
    const el = areaRef.current;
    if (!el) return;
    const max = maxBoxHeight(el, minHeight, top);
    const base = explicit.current ?? contentHeight.current;
    const next = Math.min(max, Math.max(minHeight, base));
    if (explicit.current != null) explicit.current = next;
    el.style.height = `${next}px`;
    setHeight(next);
    setCeiling(max);
  };

  const measureContent = () => {
    const el = areaRef.current;
    if (!el || dragging.current) return;
    const prev = el.style.height;
    el.style.height = "auto";
    contentHeight.current = el.scrollHeight;
    el.style.height = prev;
    publish();
  };

  useLayoutEffect(() => {
    measureContent();
  }, [shown]);

  useEffect(() => {
    const onChange = () => {
      if (!dragging.current) measureContent();
    };
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
  }, []);

  const onGripDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = areaRef.current;
    if (!el) return;
    event.preventDefault();
    const startY = event.clientY;
    const startTop = el.getBoundingClientRect().top;
    const startH = el.getBoundingClientRect().height;
    const scroller = el.closest(".view-detail");
    const startScroll = scroller instanceof HTMLElement ? scroller.scrollTop : 0;
    dragging.current = true;
    setGripActive(true);
    event.currentTarget.setPointerCapture(event.pointerId);

    const move = (ev: PointerEvent) => {
      if (scroller instanceof HTMLElement) scroller.scrollTop = startScroll;
      const max = maxBoxHeight(el, minHeight, startTop);
      const next = Math.round(Math.min(max, Math.max(minHeight, startH + ev.clientY - startY)));
      explicit.current = next;
      el.style.height = `${next}px`;
      setHeight(next);
      setCeiling(max);
    };
    const end = () => {
      dragging.current = false;
      setGripActive(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const stepHeight = (delta: number) => {
    const el = areaRef.current;
    if (!el) return;
    const max = maxBoxHeight(el, minHeight);
    const next = Math.round(Math.min(max, Math.max(minHeight, height + delta)));
    explicit.current = next;
    publish();
  };

  return (
    <div
      className="group relative min-w-0 [overflow-anchor:none]"
      onPointerEnter={() => setFieldHot(true)}
      onPointerLeave={() => setFieldHot(false)}
    >
      <Textarea
        ref={areaRef}
        aria-label={label}
        rows={1}
        value={shown}
        placeholder={placeholder}
        autoComplete="off"
        style={{ height }}
        className={cn(
          "field-sizing-fixed resize-none overflow-x-hidden overflow-y-auto break-all px-3.5 py-1.5 pr-9 pb-3",
          heading ? "min-h-11 text-[18px] font-semibold leading-6 text-fg" : "min-h-10 text-[12.5px] leading-5 text-fg-muted",
        )}
        onFocus={(event) => {
          cancelled.current = false;
          setDraft(value);
          setEditing(true);
          if (selectOnFocus) event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false);
          if (!cancelled.current && draft.trim() !== value) onSave(draft.trim());
          cancelled.current = false;
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Escape") {
            cancelled.current = true;
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <Pencil
        size={11}
        aria-hidden="true"
        className="pointer-events-none absolute top-2.5 right-3.5 text-fg-faint transition-colors group-hover:text-accent group-focus-within:opacity-0"
      />
      <button
        type="button"
        role="slider"
        aria-orientation="vertical"
        aria-label={`调整${label}高度`}
        aria-valuemin={minHeight}
        aria-valuemax={ceiling}
        aria-valuenow={height}
        data-dragging={gripActive ? "true" : undefined}
        className="grip-hit absolute inset-x-3 bottom-0 z-10 flex h-3 cursor-ns-resize items-center justify-center touch-none"
        onPointerEnter={() => setGripHot(true)}
        onPointerLeave={() => setGripHot(false)}
        onFocus={() => setGripHot(true)}
        onBlur={() => setGripHot(false)}
        onPointerDown={onGripDown}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            stepHeight(16);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            stepHeight(-16);
          }
        }}
      >
        <span
          className="pointer-events-none block h-1 w-8 rounded-full transition-colors"
          style={{ backgroundColor: gripActive || gripHot ? "var(--color-accent)" : fieldHot ? "var(--color-accent-border)" : "var(--color-border)" }}
        />
      </button>
    </div>
  );
}
