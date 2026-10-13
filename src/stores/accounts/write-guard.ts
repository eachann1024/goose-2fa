import type { AccountsState } from "./store-types";

/** 文件尚未读完、读取失败或存在未处理冲突时，禁止用可编辑的内存状态代替文件。 */
export function canEditVault(state: AccountsState): boolean {
  return state.loadStatus === "ready"
    && (!state.syncEnabled || !["error", "conflict", "reading"].includes(state.syncStatus));
}
