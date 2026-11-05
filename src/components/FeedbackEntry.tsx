import { MessageSquare } from "lucide-react";
import { useFeedbackUnread } from "@/lib/feedback";

export function FeedbackEntry({ onFeedback }: { onFeedback: () => void }) {
  const unread = useFeedbackUnread();
  const label = unread ? "反馈（有新回复）" : "反馈";
  return (
    <button
      type="button"
      onClick={onFeedback}
      className="icon-control relative rounded-lg p-2 text-fg-muted"
      aria-label={label}
      title={label}
      data-feedback-entry
    >
      <MessageSquare size={17} />
      {unread ? <span className="pointer-events-none absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" /> : null}
    </button>
  );
}
