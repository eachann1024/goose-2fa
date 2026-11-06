import { useCallback, useEffect, useState } from "react";

/** 批量选择态：进入/退出时清空，账户被删后丢掉失效的选中项。 */
export function useBatchSelection(active: boolean, accountIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!active) setSelectedIds(new Set());
  }, [active]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(accountIds);
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [accountIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => (
      prev.size === accountIds.length ? new Set() : new Set(accountIds)
    ));
  }, [accountIds]);

  return { selectedIds, toggle, toggleAll };
}
