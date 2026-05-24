import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, Check, Copy, Trash2, MapPin, Clock, Globe, Monitor, Tag, Pencil } from "lucide-react";
import { useOtpCode } from "@/hooks/useOtpCode";
import { formatCode } from "@/lib/otp";
import type { AccountData } from "@/lib/types";
import { Input } from "@/components/ui/input";

interface AccountDetailProps {
  account: AccountData;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatCreatedAt(ts: number): string {
  const d = new Date(ts);
  const day = DAY_NAMES[d.getDay()];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${day} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLocation(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export function AccountDetail({ account, onClose, onDelete, onCopy, onUpdateNote }: AccountDetailProps) {
  const { code, remaining, period } = useOtpCode(account);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(account.note ?? "");
  const [barReady, setBarReady] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setBarReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const isTotp = account.type === "totp";
  const isLow = isTotp && remaining <= 5;
  const progress = isTotp ? remaining / period : 1;

  const displayName = account.note
    || (account.issuer ? `${account.issuer} (${account.name})` : account.name);

  const originalName = account.originalName
    || (account.issuer ? `${account.issuer} (${account.name})` : account.name);

  useEffect(() => {
    if (editingNote) noteInputRef.current?.focus();
  }, [editingNote]);

  const handleCopy = useCallback(() => {
    onCopy(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [code, onCopy]);

  const handleDelete = useCallback(() => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete(account.id);
  }, [confirmingDelete, account.id, onDelete]);

  const handleNoteSave = useCallback(() => {
    const trimmed = noteValue.trim();
    onUpdateNote(account.id, trimmed);
    setEditingNote(false);
  }, [noteValue, account.id, onUpdateNote]);

  const handleNoteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") handleNoteSave();
    if (e.key === "Escape") {
      setNoteValue(account.note ?? "");
      setEditingNote(false);
    }
  }, [handleNoteSave, account.note]);

  const meta = account.meta;

  const metaItems: { icon: React.ReactNode; label: string; value: string }[] = [];

  if (originalName !== displayName || account.note) {
    metaItems.push({
      icon: <Tag size={13} />,
      label: "原始名称",
      value: originalName,
    });
  }

  metaItems.push({
    icon: <Clock size={13} />,
    label: "添加时间",
    value: formatCreatedAt(account.createdAt),
  });

  if (meta?.location) {
    metaItems.push({
      icon: <MapPin size={13} />,
      label: "添加位置",
      value: formatLocation(meta.location.latitude, meta.location.longitude),
    });
  }

  if (meta?.timezone) {
    metaItems.push({
      icon: <Globe size={13} />,
      label: "时区",
      value: meta.timezone,
    });
  }

  if (meta?.platform) {
    metaItems.push({
      icon: <Monitor size={13} />,
      label: "设备",
      value: meta.platform,
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg px-5 pb-6 pt-4">
      {/* 顶栏 */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          aria-label="返回"
        >
          <ArrowLeft size={17} />
        </button>
        <span className="text-[15px] font-semibold tracking-tight text-fg">
          账户详情
        </span>
      </div>

      {/* 备注名称（可编辑） */}
      <div className="mb-5">
        {editingNote ? (
          <Input
            ref={noteInputRef}
            type="text"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={handleNoteSave}
            onKeyDown={handleNoteKeyDown}
            placeholder={originalName}
            className="h-[44px] border-accent/40 px-3.5 py-0 text-[18px] font-semibold leading-none focus:border-accent/70"
            style={{ caretColor: "var(--color-accent)" }}
          />
        ) : (
          <button
            onClick={() => { setNoteValue(account.note ?? ""); setEditingNote(true); }}
            className="group flex h-[44px] w-full items-center gap-2 rounded-cell border border-transparent px-3.5 text-left"
          >
            <span className="text-[18px] font-semibold leading-none text-fg">
              {displayName}
            </span>
            <Pencil size={13} className="shrink-0 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>

      {/* 验证码区 */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleCopy}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCopy(); }}
        className={`mb-2 flex cursor-pointer items-center justify-between rounded-cell border p-5 transition-all duration-150 ${
          copied
            ? "copied-flash border-copied/30"
            : "bg-surface hover:bg-surface-hover active:scale-[0.98]"
        }`}
      >
        <span
          className={`flex h-[34px] items-center font-mono text-[34px] font-semibold leading-none tracking-[0.08em] transition-colors duration-200 ${
            copied ? "text-copied" : isLow ? "text-timer-low" : "text-fg"
          }`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {copied ? (
            <span className="flex items-center gap-2 text-[22px]">
              <Check size={22} strokeWidth={2.5} />
              已复制
            </span>
          ) : (
            formatCode(code)
          )}
        </span>
        {!copied && (
          <Copy size={17} className="text-fg-faint" />
        )}
      </div>

      {/* 进度条 */}
      {isTotp && (
        <div className="mb-6 h-[4px] w-full overflow-hidden rounded-full bg-border/60">
          <div
            className={`timer-bar h-full rounded-full ${
              isLow ? "bg-timer-low" : "bg-accent/70"
            } ${barReady ? "" : "no-transition"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {!isTotp && (
        <div className="mb-6 flex items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">
            HOTP
          </span>
          <span className="text-[10px] text-fg-faint">
            #{account.counter}
          </span>
        </div>
      )}

      {/* 元数据 */}
      <div className="mb-6 rounded-cell border bg-surface p-4">
        <div className="flex flex-col gap-3">
          {metaItems.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-fg-faint">{item.icon}</span>
              <div className="min-w-0">
                <span className="block text-[11px] text-fg-faint">{item.label}</span>
                <span className="block text-[12.5px] text-fg-muted">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 删除 */}
      <div className="mt-auto">
        {confirmingDelete ? (
          <div className="flex items-center justify-between rounded-cell border border-timer-low/20 bg-timer-low/5 px-4 py-3">
            <span className="text-[12.5px] text-fg-muted">确认删除此账户?</span>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 rounded-lg bg-timer-low px-3 py-1.5 text-[12px] font-medium text-accent-fg transition-colors hover:opacity-90"
              >
                <Check size={12} />
                确认
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg border px-3 py-1.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-surface-hover"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="flex w-full items-center justify-center gap-1.5 rounded-cell border py-2.5 text-[12.5px] text-fg-faint transition-colors hover:border-timer-low/30 hover:bg-timer-low/5 hover:text-timer-low"
          >
            <Trash2 size={13} />
            删除账户
          </button>
        )}
      </div>
    </div>
  );
}
