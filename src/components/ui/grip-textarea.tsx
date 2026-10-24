import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type TextareaHTMLAttributes } from "react";

const EDGE = 16;

export type GripPaint = { rest: string; warm: string; hot: string };

export const gripPaint = {
  brand: { rest: "var(--color-border)", warm: "var(--color-accent-border)", hot: "var(--color-accent)" },
  goose: {
    rest: "var(--color-border, hsl(var(--border)))",
    warm: "color-mix(in srgb, var(--goose-accent-solid, var(--goose-accent-focus)) 42%, transparent)",
    hot: "var(--goose-accent-solid, var(--goose-accent-focus))",
  },
  accent: {
    rest: "var(--border, var(--field-border))",
    warm: "var(--accent-border, color-mix(in srgb, var(--accent) 45%, transparent))",
    hot: "var(--accent)",
  },
  ink: { rest: "var(--border)", warm: "var(--foreground)", hot: "var(--foreground)" },
} as const;

type GripProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  gripLabel: string;
  minHeight?: number;
  paint: GripPaint;
  fitContent?: boolean;
};

function viewOf(field: HTMLElement) {
  let node = field.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    if (/(auto|scroll)/.test(style.overflowY) && box.height > 120 && box.height < window.innerHeight - 4) {
      return { bottom: box.bottom, height: box.height, scroller: node };
    }
    node = node.parentElement;
  }
  return { bottom: window.innerHeight, height: window.innerHeight, scroller: null as HTMLElement | null };
}

function maxHeight(field: HTMLElement, min: number, top = field.getBoundingClientRect().top) {
  const view = viewOf(field);
  const room = Math.floor(view.bottom - EDGE - top);
  const cap = Math.floor(view.height - EDGE);
  return { max: Math.max(min, Math.min(room, cap)), scroller: view.scroller };
}

export function GripTextarea({ gripLabel, minHeight = 64, paint, fitContent = true, className, style, onChange, ...props }: GripProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const contentHeight = useRef(minHeight);
  const explicit = useRef<number | null>(null);
  const dragging = useRef(false);
  const stopDrag = useRef<(() => void) | null>(null);
  const [gripActive, setGripActive] = useState(false);
  const [fieldHot, setFieldHot] = useState(false);
  const [gripHot, setGripHot] = useState(false);
  const [height, setHeight] = useState<number | null>(fitContent ? minHeight : null);
  const [ceiling, setCeiling] = useState(minHeight);
  const sized = () => frameRef.current ?? areaRef.current;

  const publish = (top?: number) => {
    const el = sized();
    if (!el) return;
    const { max } = maxHeight(el, minHeight, top);
    const base = explicit.current ?? contentHeight.current;
    const next = Math.min(max, Math.max(minHeight, base));
    if (explicit.current != null) explicit.current = next;
    setHeight(next);
    setCeiling(max);
  };

  const measure = () => {
    const el = areaRef.current;
    if (!el || dragging.current || !fitContent) return;
    const prev = el.style.height;
    el.style.height = "auto";
    contentHeight.current = el.scrollHeight;
    el.style.height = prev;
    publish();
  };

  useLayoutEffect(() => {
    measure();
  }, [props.value]);

  useEffect(() => {
    const onResize = () => {
      if (!dragging.current) publish();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      stopDrag.current?.();
    };
  }, []);

  const onGripDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const el = sized();
    if (!el) return;
    event.preventDefault();
    const startY = event.clientY;
    const startTop = el.getBoundingClientRect().top;
    const startH = el.getBoundingClientRect().height;
    const scroller = maxHeight(el, minHeight, startTop).scroller;
    const startScroll = scroller?.scrollTop ?? 0;
    dragging.current = true;
    setGripActive(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      if (scroller) scroller.scrollTop = startScroll;
      const { max } = maxHeight(el, minHeight, startTop);
      const next = Math.round(Math.min(max, Math.max(minHeight, startH + ev.clientY - startY)));
      explicit.current = next;
      setHeight(next);
      setCeiling(max);
    };
    const end = () => {
      dragging.current = false;
      setGripActive(false);
      stopDrag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    stopDrag.current = end;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const step = (delta: number) => {
    const el = sized();
    if (!el) return;
    const { max } = maxHeight(el, minHeight);
    const next = Math.round(Math.min(max, Math.max(minHeight, (explicit.current ?? el.getBoundingClientRect().height) + delta)));
    explicit.current = next;
    setHeight(next);
    setCeiling(max);
  };

  const box: CSSProperties = {
    height: height ?? undefined,
    minHeight,
    resize: "none",
    overflowX: "hidden",
    overflowY: "auto",
    overflowWrap: "anywhere",
    boxSizing: "border-box",
    paddingBottom: 12,
    width: "100%",
    fieldSizing: "fixed" as CSSProperties["fieldSizing"],
    ...style,
  };

  return (
    <div
      ref={frameRef}
      style={{ position: "relative", width: "100%", minWidth: 0 }}
      onPointerEnter={() => setFieldHot(true)}
      onPointerLeave={() => setFieldHot(false)}
    >
      <textarea
        {...props}
        ref={areaRef}
        className={className}
        style={box}
        onChange={(event) => {
          onChange?.(event);
          measure();
        }}
      />
      <button
        type="button"
        role="slider"
        aria-orientation="vertical"
        aria-label={`调整${gripLabel}高度`}
        aria-valuemin={minHeight}
        aria-valuemax={ceiling}
        aria-valuenow={Math.round(height ?? minHeight)}
        className="grip-hit"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 0,
          zIndex: 10,
          height: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "ns-resize",
          touchAction: "none",
          border: 0,
          padding: 0,
          margin: 0,
          minHeight: 0,
          background: "transparent",
          appearance: "none",
        }}
        onPointerEnter={() => setGripHot(true)}
        onPointerLeave={() => setGripHot(false)}
        onFocus={() => setGripHot(true)}
        onBlur={() => setGripHot(false)}
        onPointerDown={onGripDown}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            step(event.key === "ArrowDown" ? 16 : -16);
          }
        }}
      >
        <span
          style={{
            pointerEvents: "none",
            display: "block",
            height: 4,
            width: 32,
            borderRadius: 999,
            background: gripActive || gripHot ? paint.hot : fieldHot ? paint.warm : paint.rest,
            transition: "background-color 120ms ease",
          }}
        />
      </button>
    </div>
  );
}
