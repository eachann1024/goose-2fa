import { useLayoutEffect, useState } from "react";

/** 首帧及重新打开时直接定位到当前进度，之后才启用逐秒过渡。 */
export function useTimerReady(key: string) {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      setReady(false);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setReady(true));
      });
    };
    reset();
    window.addEventListener("goose-2fa:plugin-enter", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("goose-2fa:plugin-enter", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [key]);

  return ready;
}
