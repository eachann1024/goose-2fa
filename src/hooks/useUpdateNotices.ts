import { useEffect, useState } from "react";
import { version as currentVersion } from "../../package.json";
import { compareVersions, noticesAfter } from "@/lib/update-notices";
import { loadCachedNoticeFeed, refreshNoticeFeed } from "@/lib/update-notice-source";
import { acknowledgeNotices, loadNoticeCursor } from "@/lib/update-notice-storage";

export function useUpdateNotices() {
  const [cursor, setCursor] = useState(() => loadNoticeCursor(currentVersion));
  const [feed, setFeed] = useState(loadCachedNoticeFeed);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(cursor.readVersion);
  const pending = noticesAfter(feed.notices, cursor.readVersion);
  const notices = noticesAfter(feed.notices, from);
  const unread = pending.length > 0;

  useEffect(() => {
    let active = true;
    const refresh = (force = false) => {
      if (active) setFeed((previous) => ({ ...previous, status: "checking" }));
      void refreshNoticeFeed(force).then((next) => { if (active) setFeed(next); });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setCursor(loadNoticeCursor(currentVersion));
        refresh();
      }
    };
    const onOnline = () => refresh(true);
    const onStorage = () => setCursor(loadNoticeCursor(currentVersion));
    refresh();
    const timer = setInterval(onVisible, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // 在内容已渲染且面板仍打开后确认已读；面板关闭不会推进游标。
  useEffect(() => {
    const through = notices[0]?.version;
    if (!open || !through || compareVersions(through, cursor.readVersion) <= 0) return;
    setCursor(acknowledgeNotices(cursor, through, from));
  }, [open, notices, cursor, from]);

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const latest = loadNoticeCursor(currentVersion);
      setCursor(latest);
      setFrom(noticesAfter(feed.notices, latest.readVersion).length ? latest.readVersion : latest.rangeStart);
      setFeed((previous) => ({ ...previous, status: "checking" }));
      void refreshNoticeFeed().then(setFeed);
    }
    setOpen(nextOpen);
  };

  const retry = () => {
    setFeed((previous) => ({ ...previous, status: "checking" }));
    void refreshNoticeFeed(true).then(setFeed);
  };

  return { open, onOpenChange, unread, notices, status: feed.status, retry, currentVersion };
}
