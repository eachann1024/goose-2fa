import { canEditVault } from "./write-guard";
import { arrayMove } from "@dnd-kit/sortable";
import type { VaultGroup } from "@/lib/types";
import { UNGROUPED_KEY, buildGroupTallies, nextGroupOrder, normalizeGroupName } from "@/lib/groups";
import type { AccountsState, StoreGet, StoreSet, StoreServices } from "./store-types";
import { GROUP_KEY, saveGroupOrder } from "./preferences";

export function createGroupActions(set: StoreSet, get: StoreGet, services: StoreServices): Pick<AccountsState, "createGroup" | "renameGroup" | "deleteGroup" | "reorderGroups"> {
  return {
    createGroup: (name) => {
      if (!canEditVault(get())) return null;
      const cleaned = normalizeGroupName(name);
      if (!cleaned) return null;
      const groups = get().groups;
      if (groups.some((g) => g.name.localeCompare(cleaned, undefined, { sensitivity: "accent" }) === 0)) return null;
      const group: VaultGroup = {
        id: crypto.randomUUID(),
        name: cleaned,
        order: nextGroupOrder(groups),
        createdAt: Date.now(),
      };
      const next = [...groups, group];
      void services.persistGroups(next).then(() => services.scheduleSync());
      set({ groups: next, selectedGroup: group.id });
      localStorage.setItem(GROUP_KEY, group.id);
      return group.id;
    },

    renameGroup: (id, name) => {
      if (!canEditVault(get())) return false;
      const cleaned = normalizeGroupName(name);
      if (!cleaned) return false;
      const groups = get().groups;
      if (groups.some((g) => g.id !== id && g.name.localeCompare(cleaned, undefined, { sensitivity: "accent" }) === 0)) return false;
      const next = groups.map((g) => (g.id === id ? { ...g, name: cleaned } : g));
      void services.persistGroups(next).then(() => services.scheduleSync());
      set({ groups: next });
      return true;
    },

    deleteGroup: (id) => {
      if (!canEditVault(get())) return;
      if (id === UNGROUPED_KEY) return;
      const nextGroups = get().groups.filter((g) => g.id !== id);
      const groupOrder = get().groupOrder.filter((groupId) => groupId !== id);
      saveGroupOrder(groupOrder);
      const nextAccounts = get().accounts.map((a) =>
        a.groupId === id ? { ...a, groupId: null } : a,
      );
      const nextTrash = get().trash.map((a) =>
        a.groupId === id ? { ...a, groupId: null } : a,
      );
      void services.persistGroups(nextGroups).then(() => services.scheduleSync());
      services.persist(nextAccounts);
      services.persistTrash(nextTrash);
      const selectedGroup =
        get().selectedGroup === id ? null : get().selectedGroup;
      if (selectedGroup) localStorage.setItem(GROUP_KEY, selectedGroup);
      else localStorage.removeItem(GROUP_KEY);
      set({ groups: nextGroups, groupOrder, accounts: nextAccounts, trash: nextTrash, selectedGroup });
    },

    reorderGroups: (activeId, overId) => {
      if (!canEditVault(get())) return;
      if (activeId === overId) return;
      const current = get().groups;
      const sorted = buildGroupTallies(current, get().accounts, get().groupOrder);
      const from = sorted.findIndex((g) => g.id === activeId);
      const to = sorted.findIndex((g) => g.id === overId);
      if (from === -1 || to === -1) return;
      const groupOrder = arrayMove(sorted, from, to).map((group) => group.id);
      const positions = new Map(groupOrder.map((id, index) => [id, index]));
      const moved = current.map((group) => ({ ...group, order: positions.get(group.id)! }));
      saveGroupOrder(groupOrder);
      void services.persistGroups(moved).then(() => services.scheduleSync());
      set({ groups: moved, groupOrder });
    }
  };
}
