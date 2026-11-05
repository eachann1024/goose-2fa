import { useEffect } from "react";
import type { PluginEnterDetail } from "@/platform/types";

export function useHostTheme(syncSystemDark: (isDark: boolean) => void) {
  useEffect(() => {
    const handleThemeChanged = (e: CustomEvent<{ isDark: boolean }>) => {
      if (localStorage.getItem("goose-2fa-dark") === null) syncSystemDark(e.detail.isDark);
    };
    window.addEventListener("goose-2fa:theme-changed", handleThemeChanged as EventListener);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("goose-2fa-dark") === null) syncSystemDark(e.matches);
    };
    mq.addEventListener("change", mqHandler);
    return () => {
      window.removeEventListener("goose-2fa:theme-changed", handleThemeChanged as EventListener);
      mq.removeEventListener("change", mqHandler);
    };
  }, [syncSystemDark]);
}

export function usePluginSession(
  load: () => void,
  setSearchQuery: (query: string) => void,
  setQuickQuery: (query: string) => void,
  setQuickMode: (value: boolean) => void,
) {
  useEffect(() => {
    const handleEnter = (e: Event) => {
      const detail = (e as CustomEvent<PluginEnterDetail>).detail;
      load();
      if (detail?.code === "quick") {
        const raw = (detail?.payload ?? "").trim();
        const query = raw.replace(/^(2fa|otp|验证码)\s+/i, "").trim();
        setQuickQuery(query);
        setQuickMode(true);
      } else {
        setQuickQuery("");
        setQuickMode(false);
        setSearchQuery("");
      }
    };
    const handleOut = () => setQuickMode(false);
    window.addEventListener("goose-2fa:plugin-enter", handleEnter);
    window.addEventListener("goose-2fa:plugin-out", handleOut);
    return () => {
      window.removeEventListener("goose-2fa:plugin-enter", handleEnter);
      window.removeEventListener("goose-2fa:plugin-out", handleOut);
    };
  }, [load, setSearchQuery, setQuickQuery, setQuickMode]);
}
