import { canEditVault } from "./write-guard";
import { arrayMove } from "@dnd-kit/sortable";
import type { AccountData, NewAccountInput } from "@/lib/types";
import { normalizeNewAccountInput } from "@/lib/account-validation";
import { generateHOTP, generateTOTP } from "@/lib/otp";
import { DEFAULT_GROUP_NAME, UNGROUPED_KEY, nextGroupOrder } from "@/lib/groups";
import type { AccountsState, Notice, StoreGet, StoreSet, StoreRuntime, StoreServices } from "./store-types";

export function createAccountActions(set: StoreSet, get: StoreGet, runtime: StoreRuntime, services: StoreServices): Pick<AccountsState, "save" | "reorderAccounts" | "addAccount" | "importAccounts" | "updateNote" | "updateRemark" | "updateAccountGroup" | "moveAccounts" | "incrementCounter"> {
  return {
    save: (accounts) => {
      if (!canEditVault(get())) return;
      services.persist(accounts);
      set({ accounts });
    },

    reorderAccounts: (activeId, overId) => {
      if (!canEditVault(get())) return;
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
      if (!canEditVault(get())) {
        set({ notice: { message: "数据源尚未就绪，暂时无法添加账户", tone: "error" } });
        return;
      }
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
      const saved = services.persist(next);
      set({ accounts: next, showAddForm: false });
      void saved.then(async (success) => {
        if (!success) return;
        set({ notice: { message: `已添加「${displayName}」`, tone: "success" } });
        if (get().syncEnabled) {
          await runtime.syncQueue;
          const state = get();
          if (state.syncStatus !== "success"
            || runtime.lastSyncFingerprint !== services.syncFingerprint(state.syncPath, state.accounts, state.groups, state.trash)) return;
        }
        try {
          const code = account.type === "hotp"
            ? await generateHOTP(account.secret, account.counter, account.digits, account.algorithm)
            : (await generateTOTP(account.secret, account.period, account.digits, account.algorithm)).code;
          await runtime.platform.copyText(code);
          if (await runtime.platform.readClipboardText() !== code) {
            throw new Error("Clipboard verification failed");
          }
        } catch {
          runtime.platform.showNotification("添加成功，验证码复制失败，请手动复制");
          return;
        }
        runtime.platform.showNotification("添加成功，验证码已复制到剪贴板");
      });
    },

    importAccounts: (inputs, importedGroups = []) => {
      if (!canEditVault(get())) {
        set({ notice: { message: "数据源尚未就绪，暂时无法导入账户", tone: "error" } });
        return;
      }
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
      if (newAccounts.length === 0) {
        set({
          showAddForm: false,
          showDataTransfer: false,
          notice: { message: "没有可导入的账户", tone: "error" },
        });
        return;
      }
      const next = [...get().accounts, ...newAccounts];
      if (mergedGroups.length !== currentGroups.length) services.persistGroups(mergedGroups);
      const saved = services.persist(next);
      const first = newAccounts[0]!;
      const skipped = inputs.length - newAccounts.length;
      const base = newAccounts.length === 1
        ? `已导入「${first.issuer || first.name}」`
        : `已导入 ${newAccounts.length} 个账户`;
      const notice: Notice = {
        message: skipped > 0 ? `${base}，跳过 ${skipped} 条无效数据` : base,
        tone: "success",
      };
      set({ accounts: next, groups: mergedGroups, showAddForm: false, showDataTransfer: false });
      // 写盘成功才宣布成功，失败时交给存储层的错误通知。
      void saved.then((success) => {
        if (success) set({ notice });
      });
      // 跳到导入账户所在分组：导入完成后直接看到结果，而不是停在原来的分组。
      if (mergedGroups.length === 0) {
        get().setSelectedGroup(null);
      } else {
        get().setSelectedGroup(first.groupId ?? UNGROUPED_KEY);
      }
    },

    updateNote: (id, note) => {
      if (!canEditVault(get())) return;
      const next = get().accounts.map((a) =>
        a.id === id ? { ...a, note } : a,
      );
      services.persist(next);
      set({ accounts: next });
    },

    updateRemark: (id, remark) => {
      if (!canEditVault(get())) return;
      const next = get().accounts.map((a) =>
        a.id === id ? { ...a, remark } : a,
      );
      services.persist(next);
      set({ accounts: next });
    },

    updateAccountGroup: (id, groupId) => {
      if (!canEditVault(get())) return;
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

    moveAccounts: (ids, groupId) => {
      if (!canEditVault(get())) {
        set({ notice: { message: "数据源尚未就绪，暂时无法移动账户", tone: "error" } });
        return;
      }
      if (ids.length === 0) return;
      if (groupId !== null && !get().groups.some((group) => group.id === groupId)) return;
      const idSet = new Set(ids);
      const moved = get().accounts.filter(
        (account) => idSet.has(account.id) && (account.groupId ?? null) !== groupId,
      );
      if (moved.length === 0) {
        set({
          editMode: false,
          notice: { message: "所选账户已在目标分组", tone: "success" },
        });
        return;
      }
      const next = get().accounts.map((account) =>
        idSet.has(account.id) ? { ...account, groupId } : account,
      );
      const groupName = groupId
        ? get().groups.find((group) => group.id === groupId)?.name ?? ""
        : DEFAULT_GROUP_NAME;
      const saved = services.persist(next);
      set({ accounts: next, editMode: false });
      // 跳到目标分组，让移动结果立刻可见。
      if (get().groups.length === 0) get().setSelectedGroup(null);
      else get().setSelectedGroup(groupId ?? UNGROUPED_KEY);
      void saved.then((success) => {
        if (!success) return;
        set({ notice: { message: `已将 ${moved.length} 个账户移动到「${groupName}」`, tone: "success" } });
      });
    },

    incrementCounter: async (id) => {
      if (!canEditVault(get())) return false;
      const account = get().accounts.find((a) => a.id === id);
      if (!account || account.type !== "hotp") return false;
      const next = get().accounts.map((a) =>
        a.id === id ? { ...a, counter: a.counter + 1 } : a,
      );
      set({ accounts: next });
      // 输出前先持久化递增（含数据源文件），失败则调用方不得显示或发送该验证码。
      const writeVersionBefore = runtime.syncWriteVersion;
      const saved = await services.persist(next);
      if (!saved) return false;
      if (!get().syncEnabled) return true;
      await runtime.syncQueue;
      // 绑定本次递增：只认「本次写入或载入确实发生（版本前进）」且「当前内容已落盘」。
      const after = get();
      return after.syncStatus === "success"
        && runtime.syncWriteVersion > writeVersionBefore
        && runtime.lastSyncFingerprint === services.syncFingerprint(after.syncPath, after.accounts, after.groups, after.trash);
    }
  };
}
