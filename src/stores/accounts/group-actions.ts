import { arrayMove } from "@dnd-kit/sortable";
import type { VaultGroup } from "@/lib/types";
import { UNGROUPED_KEY, nextGroupOrder, normalizeGroupName } from "@/lib/groups";
import type { AccountsState, StoreGet, StoreSet, StoreServices } from "./store-types";
import { GROUP_KEY } from "./preferences";

export function createGroupActions(set: StoreSet, get: StoreGet, services: StoreServices): Pick<AccountsState, "createGroup" | "renameGroup" | "deleteGroup" | "reorderGroups"> {
  return {
    createGroup: (name) => {
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
      services.persistGroups(next);
      set({ groups: next, selectedGroup: group.id });
      localStorage.setItem(GROUP_KEY, group.id);
      return group.id;
    },

    renameGroup: (id, name) => {
      const cleaned = normalizeGroupName(name);
      if (!cleaned) return false;
      const groups = get().groups;
      if (groups.some((g) => g.id !== id && g.name.localeCompare(cleaned, undefined, { sensitivity: "accent" }) === 0)) return false;
      const next = groups.map((g) => (g.id === id ? { ...g, name: cleaned } : g));
      services.persistGroups(next);
      set({ groups: next });
      return true;
    },

    deleteGroup: (id) => {
      const nextGroups = get().groups.filter((g) => g.id !== id);
      const nextAccounts = get().accounts.map((a) =>
        a.groupId === id ? { ...a, groupId: null } : a,
      );
      const nextTrash = get().trash.map((a) =>
        a.groupId === id ? { ...a, groupId: null } : a,
      );
      services.persistGroups(nextGroups);
      services.persist(nextAccounts);
      services.persistTrash(nextTrash);
      const selectedGroup =
        get().selectedGroup === id ? null : get().selectedGroup;
      if (selectedGroup) localStorage.setItem(GROUP_KEY, selectedGroup);
      else localStorage.removeItem(GROUP_KEY);
      set({ groups: nextGroups, accounts: nextAccounts, trash: nextTrash, selectedGroup });
    },

    reorderGroups: (activeId, overId) => {
      if (activeId === overId) return;
      if (activeId === UNGROUPED_KEY || overId === UNGROUPED_KEY) return;
      const current = get().groups;
      const sorted = [...current].sort(
        (a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh"),
      );
      const from = sorted.findIndex((g) => g.id === activeId);
      const to = sorted.findIndex((g) => g.id === overId);
      if (from === -1 || to === -1) return;
      const moved = arrayMove(sorted, from, to).map((g, i) => ({ ...g, order: i }));
      services.persistGroups(moved);
      set({ groups: moved });
    }
  };
}
