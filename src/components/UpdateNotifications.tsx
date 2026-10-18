import { Bell, X } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { useUpdateNotices } from "@/hooks/useUpdateNotices";

export function UpdateNotifications() {
  const { open, onOpenChange, unread, notices, status, retry, currentVersion } = useUpdateNotices();

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
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
              {notices.length === 0 ? (
                <div className="py-4 text-[13px] text-fg-muted">
                  <p role="status">
                    {status === "checking" ? "正在检查更新…"
                      : status === "local" ? "暂时无法获取更新记录"
                        : `当前 v${currentVersion}，暂无新的更新记录`}
                  </p>
                  {status === "local" && (
                    <button onClick={retry} className="mt-2 rounded-sm text-fg hover:underline">重新检查</button>
                  )}
                </div>
              ) : notices.map((notice) => (
                <article key={notice.id} className="border-b py-4 last:border-b-0">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[12px]">
                    <h3 className="font-semibold">v{notice.version}</h3>
                    <time dateTime={notice.date} className="text-fg-muted">{notice.date}</time>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-fg-muted">
                    {notice.items.map((item) => <li key={item} className="break-words">{item}</li>)}
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
