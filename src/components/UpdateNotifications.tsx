import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { UPDATE_NOTICES } from "@/lib/update-notices";

const READ_KEY = "goose-2fa-notices-read";

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(READ_KEY);
  } catch {
    return null;
  }
}

export function UpdateNotifications() {
  const [lastSeen, setLastSeen] = useState(readLastSeen);
  const latestId = UPDATE_NOTICES[0]?.id;
  const unread = Boolean(latestId && lastSeen !== latestId);

  const markRead = (open: boolean) => {
    if (!open || !latestId) return;
    setLastSeen(latestId);
    try {
      localStorage.setItem(READ_KEY, latestId);
    } catch {
      // 存储不可用时仍可查看通知，当前会话保持已读。
    }
  };

  return (
    <Popover.Root onOpenChange={markRead}>
      <Popover.Trigger
        className="icon-control relative rounded-lg p-2 text-fg-muted"
        aria-label={unread ? "更新通知，有未读更新" : "更新通知"}
      >
        <Bell size={17} />
        {unread && (
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" aria-hidden="true" />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup className="w-[320px] max-w-[calc(100vw-24px)] overflow-hidden rounded-cell border bg-popover text-fg shadow-md outline-none">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <Popover.Title className="text-[14px] font-semibold">更新通知</Popover.Title>
              <Popover.Close className="icon-control rounded-md p-1 text-fg-muted" aria-label="关闭通知">
                <X size={15} />
              </Popover.Close>
            </div>
            <div className="max-h-[min(360px,60vh)] overflow-y-auto px-4">
              {UPDATE_NOTICES.length === 0 ? (
                <p className="py-4 text-[13px] text-fg-muted">暂无更新通知</p>
              ) : UPDATE_NOTICES.map((notice) => (
                <article key={notice.id} className="border-b py-4 last:border-b-0">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[12px]">
                    <h3 className="font-semibold">v{notice.version}</h3>
                    <time dateTime={notice.date} className="text-fg-muted">{notice.date}</time>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-fg-muted">
                    {notice.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
