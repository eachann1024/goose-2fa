import type { AccountData } from "@/lib/types";
import type { AccountsState, StoreGet, StoreSet, StoreServices } from "./store-types";

export function createTrashActions(set: StoreSet, get: StoreGet, services: StoreServices): Pick<AccountsState, "removeAccount" | "restoreAccount" | "permanentlyDelete" | "emptyTrash"> {
  return {
    removeAccount: (id) => {
      const account = get().accounts.find((a) => a.id === id);
      const next = get().accounts.filter((a) => a.id !== id);
      services.persist(next);
      if (account) {
        const trashed = { ...account, deletedAt: Date.now() };
        const nextTrash = [...get().trash, trashed];
        services.persistTrash(nextTrash);
        set({ accounts: next, trash: nextTrash });
      } else {
        set({ accounts: next });
      }
    },

    restoreAccount: (id) => {
      const account = get().trash.find((a) => a.id === id);
      if (!account) return;
      const { deletedAt: _, ...restored } = account;
      const safeGroupId = restored.groupId && get().groups.some((group) => group.id === restored.groupId)
        ? restored.groupId
        : null;
      const nextTrash = get().trash.filter((a) => a.id !== id);
      const nextAccounts = [...get().accounts, { ...restored, groupId: safeGroupId } as AccountData];
      services.persist(nextAccounts);
      services.persistTrash(nextTrash);
      set({ accounts: nextAccounts, trash: nextTrash });
    },

    permanentlyDelete: (id) => {
      const nextTrash = get().trash.filter((a) => a.id !== id);
      services.persistTrash(nextTrash);
      set({ trash: nextTrash });
    },

    emptyTrash: () => {
      services.persistTrash([]);
      set({ trash: [] });
    }
  };
}
