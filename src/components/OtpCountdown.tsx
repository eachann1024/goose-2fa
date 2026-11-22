import { memo } from "react";
import { useOtpCountdown } from "@/hooks/otp-clock";

export const OtpCountdown = memo(function OtpCountdown({ period, variant }: {
  period: number;
  variant: "list" | "quick" | "compact" | "grid" | "detail";
}) {
  const { remaining, timerReady } = useOtpCountdown(period);
  const isLow = remaining <= 5;
  const reset = !timerReady || remaining === period ? "timer-reset" : "";
  const progress = remaining / period;

  if (variant === "quick") {
    const circumference = 2 * Math.PI * 6.5;
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-label={`剩余 ${remaining} 秒`}>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--color-border)" strokeWidth="2" />
        <circle
          className={`timer-ring ${reset}`} cx="8" cy="8" r="6.5" fill="none"
          stroke={isLow ? "var(--color-timer-low)" : "var(--color-accent)"} strokeWidth="2"
          strokeLinecap="round" strokeDasharray={circumference}
          style={{ strokeDashoffset: circumference * (1 - progress) }} transform="rotate(-90 8 8)"
        />
      </svg>
    );
  }

  if (variant === "list") {
    const circumference = 2 * Math.PI * 15.5;
    return (
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-border-soft" />
          <circle
            cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
            className={`timer-ring ${reset} ${isLow ? "stroke-timer-low" : "stroke-accent"}`}
            strokeDasharray={circumference} style={{ strokeDashoffset: circumference * (1 - progress) }}
          />
        </svg>
        <span className="absolute text-[10px] font-medium tabular-nums text-fg-faint">{remaining}</span>
      </div>
    );
  }

  const bar = variant === "compact" ? "mt-2 h-[2px] bg-border"
    : variant === "grid" ? "mt-3 h-[4px] bg-border-soft" : "mb-6 h-[4px] bg-border-soft";
  return (
    <div className={`w-full overflow-hidden rounded-full ${bar}`}>
      <div
        className={`timer-bar h-full rounded-full ${reset} ${isLow ? "bg-timer-low" : "bg-accent"}`}
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
});
