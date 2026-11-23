import { useEffect, useState } from "react";
import { Switch } from "@base-ui/react/switch";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  isTelemetryEnabled,
  setTelemetryEnabled,
  subscribeTelemetry,
  telemetryPreview,
} from "@/lib/analytics";

export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState(() => isTelemetryEnabled());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(() => telemetryPreview());

  useEffect(() => {
    const sync = () => {
      setEnabled(isTelemetryEnabled());
      setPreview(telemetryPreview());
    };
    sync();
    return subscribeTelemetry(sync);
  }, []);

  const handleToggle = (checked: boolean) => {
    setTelemetryEnabled(checked);
    setEnabled(isTelemetryEnabled());
    setPreview(telemetryPreview());
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-[15px]">隐私与统计</DialogTitle>
          <DialogClose
            className="icon-control rounded-md p-1 text-fg-muted"
            aria-label="关闭"
          >
            <X size={15} />
          </DialogClose>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-cell border bg-surface px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="telemetry-switch" className="block text-[13px] font-medium text-fg">
              发送匿名使用统计
            </label>
            <p className="mt-0.5 text-[11.5px] leading-snug text-fg-muted">
              只统计功能使用次数和报错类型，不含任何账号、密钥或验证码内容，关闭后会删除匿名编号
            </p>
          </div>
          <Switch.Root
            id="telemetry-switch"
            checked={enabled}
            onCheckedChange={handleToggle}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-border transition-colors data-checked:bg-accent"
          >
            <Switch.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-surface shadow-xs transition-transform data-checked:translate-x-[18px] data-checked:bg-accent-fg" />
          </Switch.Root>
        </div>

        <p className="text-[11.5px] leading-relaxed text-fg-muted">
          联网说明：匿名统计与意见反馈连接 feedback-api.cooool.top；更新通知拉取自 raw.githubusercontent.com 与 jsdelivr.net；账户密钥与验证码仅保存在本地。
        </p>

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={previewOpen}
            onClick={() => {
              setPreview(telemetryPreview());
              setPreviewOpen((open) => !open);
            }}
          >
            查看上报内容
          </Button>
        </div>

        {previewOpen ? (
          <pre
            aria-label="上报内容"
            className="max-h-56 overflow-auto rounded-lg border bg-surface p-3 font-mono text-[11px] leading-relaxed text-fg-muted select-text"
          >
            {JSON.stringify(preview, null, 2)}
          </pre>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
