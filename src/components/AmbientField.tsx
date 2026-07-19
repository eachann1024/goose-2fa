interface AmbientFieldProps {
  enabled: boolean;
  isDark: boolean;
}

/** 轻量静态氛围层：不占用 WebGL，也不运行逐帧动画。 */
export function AmbientField({ enabled, isDark }: AmbientFieldProps) {
  if (!enabled) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className={`ambient-wash ${isDark ? "ambient-wash-dark" : "ambient-wash-light"}`} />
    </div>
  );
}
