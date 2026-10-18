import { Clock, FolderOpen, Globe, MapPin, Monitor, Tag } from "lucide-react";
import type { AccountData, VaultGroup } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountMetadataProps {
  account: AccountData;
  groups: VaultGroup[];
  originalName: string;
  displayName: string;
  onUpdateGroup: (id: string, groupId: string | null) => void;
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

export function AccountMetadata({ account, groups, originalName, displayName, onUpdateGroup }: AccountMetadataProps) {
  const meta = account.meta;

  const metaItems: { icon: React.ReactNode; label: string; value: string }[] = [];

  if (originalName !== displayName) {
    metaItems.push({
      icon: <Tag size={13} />,
      label: "原始名称",
      value: originalName,
    });
  }

  const createdAt = formatCreatedAt(account.createdAt);

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

  const groupOptions = [
    { value: null, label: groups.length > 0 ? "默认" : "全部" },
    ...[...groups]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh"))
      .map((group) => ({ value: group.id, label: group.name })),
  ];

  return (
    <>
      {/* 分组与添加时间 */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <section className="flex min-w-0 flex-col rounded-cell border bg-surface px-3.5 py-3" aria-labelledby="account-group-label">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen size={13} className="text-fg-faint" />
            <span id="account-group-label" className="text-[11px] text-fg-faint">分组</span>
          </div>
          <Select<string>
            items={groupOptions}
            value={account.groupId ?? null}
            onValueChange={(value) => onUpdateGroup(account.id, value)}
          >
            <SelectTrigger
              className="group/select h-9 w-full min-w-0 text-[12.5px]"
              aria-label="移动到分组"
            >
              <SelectValue placeholder={groups.length > 0 ? "默认" : "全部"} />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {groupOptions.map((option) => (
                  <SelectItem key={option.value ?? "ungrouped"} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {groups.length === 0 && (
            <p className="mt-2 text-[10.5px] leading-snug text-fg-faint">
              可在主界面创建分组
            </p>
          )}
        </section>

        <section className="flex min-w-0 flex-col rounded-cell border bg-surface px-3.5 py-3" aria-labelledby="account-created-label">
          <div className="mb-2 flex items-center gap-2">
            <Clock size={13} className="text-fg-faint" />
            <span id="account-created-label" className="text-[11px] text-fg-faint">添加时间</span>
          </div>
          <time
            dateTime={new Date(account.createdAt).toISOString()}
            className="break-words text-[12px] leading-relaxed text-fg-muted"
          >
            {createdAt}
          </time>
        </section>
      </div>

      {/* 元数据 */}
      {metaItems.length > 0 && <div className="mb-6 rounded-cell border bg-surface p-4">
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
      </div>}

    </>
  );
}
