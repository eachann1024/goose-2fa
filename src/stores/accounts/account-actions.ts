import { arrayMove } from "@dnd-kit/sortable";
import type { AccountData, NewAccountInput } from "@/lib/types";
import { normalizeNewAccountInput } from "@/lib/account-validation";
import { UNGROUPED_KEY, nextGroupOrder } from "@/lib/groups";
import type { AccountsState, StoreGet, StoreSet, StoreServices } from "./store-types";

export function createAccountActions(set: StoreSet, get: StoreGet, services: StoreServices): Pick<AccountsState, "save" | "reorderAccounts" | "addAccount" | "importAccounts" | "updateNote" | "updateRemark" | "updateAccountGroup" | "incrementCounter"> {
  return {
    save: (accounts) => {
      services.persist(accounts);
      set({ accounts });
    },

    reorderAccounts: (activeId, overId) => {
      if (activeId === overId) return;
      const current = get().accounts;
      const from = current.findIndex((a) => a.id === activeId);
      const to = current.findIndex((a) => a.id === overId);
      if (from === -1 || to === -1) return;
      const next = arrayMove(current, from, to);
      services.persist(next);
      set({ accounts: next });
    },

    addAccount: (input) => {
      const normalized = normalizeNewAccountInput(input);
      if (!normalized) return;
      const displayName = normalized.issuer
        ? `${normalized.issuer} (${normalized.name})`
        : normalized.name;

      const selected = get().selectedGroup;
      const groupId =
        selected && selected !== UNGROUPED_KEY && get().groups.some((g) => g.id === selected)
          ? selected
          : null;

      const account: AccountData = {
        ...normalized,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        originalName: displayName,
        groupId,
      };

      const next = [...get().accounts, account];
      services.persist(next);
      set({ accounts: next, showAddForm: false });
    },

    importAccounts: (inputs, importedGroups = []) => {
      const now = Date.now();
      const selected = get().selectedGroup;
      const selectedGroupId =
        selected && selected !== UNGROUPED_KEY && get().groups.some((g) => g.id === selected)
          ? selected
          : null;
      const currentGroups = get().groups;
      const mergedGroups = [...currentGroups];
      const groupIdMap = new Map<string, string>();
      for (const imported of importedGroups) {
        const sameId = mergedGroups.find((group) => group.id === imported.id);
        const sameName = mergedGroups.find(
          (group) => group.name.localeCompare(imported.name, undefined, { sensitivity: "accent" }) === 0,
        );
        if (sameId && sameId.name.localeCompare(imported.name, undefined, { sensitivity: "accent" }) === 0) {
          groupIdMap.set(imported.id, sameId.id);
        } else if (sameName) {
          groupIdMap.set(imported.id, sameName.id);
        } else {
          const id = imported.id && !sameId ? imported.id : crypto.randomUUID();
          groupIdMap.set(imported.id, id);
          mergedGroups.push({
            ...imported,
            id,
            order: nextGroupOrder(mergedGroups),
            createdAt: imported.createdAt || now,
          });
        }
      }
      const newAccounts = inputs
        .map(normalizeNewAccountInput)
        .filter((input): input is NewAccountInput => input !== null)
        .map((input, i) => ({
          ...input,
          id: crypto.randomUUID(),
          createdAt: now + i,
          groupId: importedGroups.length > 0
            ? (input.groupId ? groupIdMap.get(input.groupId) ?? null : null)
            : selectedGroupId,
        }));
      const next = [...get().accounts, ...newAccounts];
      if (mergedGroups.length !== currentGroups.length) services.persistGroups(mergedGroups);
      services.persist(next);
      set({ accounts: next, groups: mergedGroups });
    },

    updateNote: (id, note) => {
      const next = get().accounts.map((a) =>
        a.id === id ? { ...a, note } : a,
      );
      services.persist(next);
      set({ accounts: next });
    },

    updateRemark: (id, remark) => {
      const next = get().accounts.map((a) =>
        a.id === id ? { ...a, remark } : a,
      );
      services.persist(next);
      set({ accounts: next });
    },

    updateAccountGroup: (id, groupId) => {
      if (groupId !== null && !get().groups.some((group) => group.id === groupId)) return;
      const safeGroupId = groupId;
      const current = get().accounts.find((account) => account.id === id);
      if (!current || (current.groupId ?? null) === safeGroupId) return;
      const next = get().accounts.map((a) =>
        a.id === id ? { ...a, groupId: safeGroupId } : a,
      );
      services.persist(next);
      set({ accounts: next });
    },

    incrementCounter: (id) => {
      const next = get().accounts.map((a) =>
        a.id === id ? { ...a, counter: a.counter + 1 } : a,
      );
      services.persist(next);
      set({ accounts: next });
    }
  };
}
