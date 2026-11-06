import type { AccountData, VaultGroup } from "@/lib/types";
import { detailFaceClass, type ViewState } from "@/lib/view-transition";
import { AccountDetail } from "./AccountDetail";

interface DetailLayerProps {
  account: AccountData | null;
  viewState: ViewState;
  groups: VaultGroup[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => Promise<boolean>;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateRemark: (id: string, remark: string) => void;
  onUpdateGroup: (id: string, groupId: string | null) => void;
}

/** 详情面：盖在主列表上方，关闭动画结束后再交还焦点。 */
export function DetailLayer({
  account,
  viewState,
  groups,
  onClose,
  onDelete,
  onCopy,
  onUpdateNote,
  onUpdateRemark,
  onUpdateGroup,
}: DetailLayerProps) {
  if (!account) {
    return <div className="view-face view-detail pointer-events-none" aria-hidden="true" />;
  }

  return (
    <div
      className={detailFaceClass(viewState)}
      inert={viewState === "idle" ? true : undefined}
      aria-hidden={viewState === "idle"}
    >
      <AccountDetail
        account={account}
        groups={groups}
        onClose={onClose}
        onDelete={onDelete}
        onCopy={onCopy}
        onUpdateNote={onUpdateNote}
        onUpdateRemark={onUpdateRemark}
        onUpdateGroup={onUpdateGroup}
      />
    </div>
  );
}
