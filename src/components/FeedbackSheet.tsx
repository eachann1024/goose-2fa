import { useRef, useState, type FormEvent } from "react";
import { usePlatform } from "@/platform/context";
import { celebrate } from "@/lib/celebrate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formControlVariants } from "@/components/ui/form-control";
import { GripTextarea, gripPaint } from "@/components/ui/grip-textarea";
import { cn } from "@/lib/utils";

const endpoint = "https://feedback-api.cooool.top/api/feedback";
const imageLimit = 20 * 1024 * 1024;
const videoLimit = 200 * 1024 * 1024;

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const platform = usePlatform();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (text.length < 4) {
      setStatus("请至少写 4 个字");
      return;
    }
    if (images.some((file) => file.size > imageLimit)) {
      setStatus("单张图片不能超过 20MB");
      return;
    }
    if (video && video.size > videoLimit) {
      setStatus("视频不能超过 200MB");
      return;
    }
    const body = new FormData();
    body.set("project", "2fa");
    body.set("message", text);
    body.set("contact", contact.trim());
    body.set("leave_blank", "");
    images.slice(0, 4).forEach((file) => body.append("images", file));
    if (video) body.set("video", video);
    setSending(true);
    setStatus("");
    try {
      const response = await fetch(endpoint, { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setStatus(data?.error || "发送失败，请稍后再试");
        return;
      }
      setMessage("");
      setImages([]);
      setVideo(null);
      platform.showNotification("已收到");
      celebrate();
      onClose();
    } catch {
      setStatus("网络不通，请稍后再试");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <div className="flex items-center justify-between">
          <DialogTitle>反馈</DialogTitle>
          <DialogClose>关闭</DialogClose>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <GripTextarea
            className={cn(formControlVariants(), "min-h-16")}
            paint={gripPaint.brand}
            gripLabel="反馈内容"
            minHeight={64}
            placeholder="遇到的问题或想要的功能"
            value={message}
            maxLength={4000}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Input
            placeholder="邮箱，选填"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => imageRef.current?.click()}>
              图片{images.length ? ` ${images.length}` : ""}
            </Button>
            <Button type="button" variant="outline" onClick={() => videoRef.current?.click()}>
              {video ? video.name : "视频"}
            </Button>
          </div>
          <Input
            ref={imageRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            aria-label="图片，最多 4 张，每张 20MB"
            onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 4))}
          />
          <Input
            ref={videoRef}
            className="sr-only"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            aria-label="视频，1 个，最大 200MB"
            onChange={(event) => setVideo(event.target.files?.[0] || null)}
          />
          {status ? <p className="text-sm text-fg-muted">{status}</p> : null}
          <Button type="submit" disabled={sending}>{sending ? "发送中" : "发送"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
