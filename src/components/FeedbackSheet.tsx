import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Video, X } from "lucide-react";
import { celebrate } from "@/lib/celebrate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formControlVariants } from "@/components/ui/form-control";
import { GripTextarea, gripPaint } from "@/components/ui/grip-textarea";
import { FeedbackConversationList } from "@/components/FeedbackConversationList";
import { cn } from "@/lib/utils";
import { feedbackFetch, feedbackToken, loadFeedback, type FeedbackMessage } from "@/lib/feedback";

type Draft = { message: string; contact: string; images: File[]; video: File | null; requestId: string };
const drafts = new Map<string, Draft>();
const imageLimit = 20 * 1024 * 1024;
const videoLimit = 95 * 1024 * 1024;

export function FeedbackSheet({ project = "2fa", onClose }: { project?: string; onClose: () => void }) {
  const saved = drafts.get(project);
  const [message, setMessage] = useState(saved?.message || "");
  const [contact, setContact] = useState(saved?.contact || "");
  const [images, setImages] = useState<File[]>(saved?.images || []);
  const [video, setVideo] = useState<File | null>(saved?.video || null);
  const requestId = useRef(saved?.requestId || crypto.randomUUID());
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pin, setPin] = useState(0);
  const [readRetry, setReadRetry] = useState(0);
  const sendingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const draft = useRef<Draft>({ message, contact, images, video, requestId: requestId.current });
  draft.current = { message, contact, images, video, requestId: requestId.current };
  const changed = () => { requestId.current = crypto.randomUUID(); };

  useEffect(() => () => { drafts.set(project, draft.current); controller.current?.abort(); }, [project]);
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const result = await loadFeedback(project, abort.signal);
        if (active) { setMessages(result.messages); setStatus(""); }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "加载失败，请稍后重试");
      } finally { if (active) setLoading(false); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [project]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sendingRef.current) return;
    if (!message.trim()) { setStatus("请输入消息"); return; }
    if (images.some((file) => file.size > imageLimit)) { setStatus("单张图片不能超过 20MB"); return; }
    if (video && video.size > videoLimit) { setStatus("视频不能超过 95MB"); return; }
    sendingRef.current = true;
    setSending(true);
    setStatus("");
    controller.current = new AbortController();
    try {
      const body = new FormData();
      body.set("project", project);
      body.set("token", feedbackToken());
      body.set("requestId", requestId.current);
      body.set("message", message.trim());
      body.set("contact", contact.trim());
      body.set("leave_blank", "");
      const username = (window as { utools?: { getUser?: () => { nickname?: string } } }).utools?.getUser?.()?.nickname;
      if (username) body.set("username", username);
      images.forEach((file) => body.append("images", file));
      if (video) body.set("video", video);
      const response = await feedbackFetch("/api/feedback", { method: "POST", body, signal: controller.current.signal }, 120000);
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!result.ok) throw new Error(result.error || "发送失败，请稍后重试");
      changed();
      draft.current = { message: "", contact, images: [], video: null, requestId: requestId.current };
      drafts.set(project, draft.current);
      setMessage("");
      setImages([]);
      setVideo(null);
      celebrate();
      const conversation = await loadFeedback(project, controller.current.signal);
      setMessages(conversation.messages);
      setPin((value) => value + 1);
      setReadRetry((value) => value + 1);
    } catch (error) {
      if (!controller.current?.signal.aborted) setStatus(error instanceof Error ? error.message : "网络不通，请稍后重试");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle>反馈</DialogTitle>
          <DialogClose>关闭</DialogClose>
        </div>
        <FeedbackConversationList project={project} messages={messages} loading={loading} pin={pin} readRetry={readRetry} />
        <form className="grid gap-3 p-4" onSubmit={submit}>
          <GripTextarea
            className={cn(formControlVariants(), "min-h-16")}
            paint={gripPaint.brand}
            gripLabel="反馈内容"
            minHeight={64}
            aria-label="反馈内容"
            placeholder="聊聊遇到的问题或新想法，我们的回复会直接显示在这里，可随时继续对话…"
            value={message}
            maxLength={4000}
            disabled={sending}
            onChange={(event) => { changed(); setMessage(event.target.value); }}
          />
          <Input aria-label="邮箱，选填" placeholder="邮箱，选填" type="email" value={contact} disabled={sending} onChange={(event) => { changed(); setContact(event.target.value); }} />
          {images.length > 0 || video ? (
            <div className="flex flex-wrap gap-2">
              {images.map((file, index) => (
                <Button key={`${file.name}-${index}`} type="button" variant="secondary" size="sm" disabled={sending} onClick={() => { changed(); setImages(images.filter((_, i) => i !== index)); }}>
                  {file.name}<X className="h-3 w-3" />
                </Button>
              ))}
              {video ? (
                <Button type="button" variant="secondary" size="sm" disabled={sending} onClick={() => { changed(); setVideo(null); }}>
                  {video.name}<X className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => imageRef.current?.click()}><ImagePlus className="h-4 w-4" />图片</Button>
            <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => videoRef.current?.click()}><Video className="h-4 w-4" />视频</Button>
            <Button className="ml-auto" type="submit" disabled={sending}>{sending ? "发送中…" : "发送"}</Button>
          </div>
          <Input ref={imageRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple aria-label="图片，最多 4 张，每张 20MB" onChange={(event) => { changed(); setImages(Array.from(event.target.files || []).slice(0, 4)); event.target.value = ""; }} />
          <Input ref={videoRef} className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime" aria-label="视频，1 个，最大 95MB" onChange={(event) => { changed(); setVideo(event.target.files?.[0] || null); event.target.value = ""; }} />
          {status ? <p role="status" className="text-sm text-fg-muted">{status}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
