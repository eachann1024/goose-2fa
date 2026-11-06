import type { VaultGroup } from "@/lib/types";
import { BatchActionBar } from "./BatchActionBar";
import { BatchToolbar } from "./BatchToolbar";

interface BatchControlsProps {
  total: number;
  selectedCount: number;
  allSelected: boolean;
  groups: VaultGroup[];
  onToggleAll: () => void;
  onExit: () => void;
  onMove: (groupId: string | null) => void;
  onRemove: () => void;
}

/** 批量管理的一组控件：顶栏（正常流）与底栏（固定）。 */
export function BatchControls(props: BatchControlsProps) {
  return (
    <>
      <BatchToolbar
        total={props.total}
        selectedCount={props.selectedCount}
        allSelected={props.allSelected}
        onToggleAll={props.onToggleAll}
        onExit={props.onExit}
      />
      <BatchActionBar
        selectedCount={props.selectedCount}
        groups={props.groups}
        onMove={props.onMove}
        onRemove={props.onRemove}
      />
    </>
  );
}
