import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { feedbackFetch, loadFeedback, type FeedbackMessage } from "@/lib/feedback";

function Attachment({ messageId, file }: { messageId: string; file: FeedbackMessage["files"][number] }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    setUrl("");
    const controller = new AbortController();
    let objectUrl = "";
    void (async () => {
      try {
        const response = await feedbackFetch(`/api/media/${messageId}/${file.index}`, { signal: controller.signal }, 120000);
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId, file.index, attempt]);
  if (!url) {
    return failed ? (
      <Button type="button" variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>附件加载失败，重试</Button>
    ) : (
      <span className="block text-sm text-fg-muted">正在加载附件…</span>
    );
  }
  return file.kind === "video" ? (
    <video src={url} controls className="max-h-56 max-w-full rounded-md" aria-label={file.name} />
  ) : (
    <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={file.name} className="max-h-56 max-w-full rounded-md" /></a>
  );
}

export function FeedbackConversationList({
  project,
  messages,
  loading,
  pin,
  readRetry,
}: {
  project: string;
  messages: FeedbackMessage[];
  loading: boolean;
  pin: number;
  readRetry: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const followLatest = useRef(false);
  const revealSent = useRef(false);
  const seenPin = useRef(pin);
  if (pin !== seenPin.current) {
    seenPin.current = pin;
    revealSent.current = true;
  }
  const messageNodes = useRef(new Map<string, HTMLDivElement>());
  const seen = useRef(new Set<string>());
  const marking = useRef(false);
  useLayoutEffect(() => {
    const root = viewport.current;
    if (root && (revealSent.current || followLatest.current)) {
      root.scrollTop = root.scrollHeight;
      revealSent.current = false;
      followLatest.current = true;
    }
  }, [messages]);
  useEffect(() => {
    const root = viewport.current;
    if (!root) return;
    let active = true;
    const mark = async () => {
      if (marking.current || document.visibilityState !== "visible" || !document.hasFocus()) return;
      let last: FeedbackMessage | undefined;
      for (const entry of messages) {
        if (!seen.current.has(entry.id)) break;
        last = entry;
      }
      if (!last || root.dataset.read === last.id) return;
      marking.current = true;
      try {
        await feedbackFetch("/api/conversation/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, messageId: last.id }),
        });
        if (active) {
          root.dataset.read = last.id;
          await loadFeedback(project);
        }
      } catch { /* 服务端确认前保持未读 */ } finally {
        marking.current = false;
      }
    };
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement && entry.target.dataset.messageId)
          seen.current.add(entry.target.dataset.messageId);
      }
      void mark();
    }, { root, threshold: 0.01 });
    messageNodes.current.forEach((node) => observer.observe(node));
    const focused = () => {
      observer.disconnect();
      messageNodes.current.forEach((node) => observer.observe(node));
      void mark();
    };
    window.addEventListener("focus", focused);
    document.addEventListener("visibilitychange", focused);
    const retry = setInterval(() => void mark(), 10000);
    return () => {
      active = false;
      observer.disconnect();
      clearInterval(retry);
      window.removeEventListener("focus", focused);
      document.removeEventListener("visibilitychange", focused);
    };
  }, [messages, project, readRetry]);
  return (
    <div
      ref={viewport}
      onScroll={(event) => {
        const root = event.currentTarget;
        followLatest.current = root.scrollHeight - root.scrollTop - root.clientHeight < 40;
      }}
      className="min-h-48 flex-1 space-y-4 overflow-y-auto bg-surface p-5"
      style={{ maxHeight: "45vh" }}
      aria-label="反馈聊天记录"
      role="log"
    >
      {!messages.length ? (
        <p className="py-10 text-center text-sm text-fg-muted">
          {loading ? "正在加载…" : "遇到的问题或想要的功能都可以直接留言，我们的回复会显示在这里，随时继续对话。"}
        </p>
      ) : messages.map((entry) => {
        const mine = entry.role === "user";
        return (
          <div
            key={entry.id}
            data-message-id={entry.id}
            ref={(node) => { if (node) messageNodes.current.set(entry.id, node); else messageNodes.current.delete(entry.id); }}
            className={`flex ${mine ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] space-y-2 rounded-xl px-4 py-3 ${mine ? "rounded-tr-sm bg-accent text-accent-fg" : "rounded-tl-sm border border-border bg-surface text-fg"}`}>
              <time dateTime={entry.at} className={`block text-xs ${mine ? "text-accent-fg" : "text-fg-faint"}`}>
                {new Date(entry.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </time>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.message}</p>
              {entry.files.map((file) => <Attachment key={file.index} messageId={entry.id} file={file} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
