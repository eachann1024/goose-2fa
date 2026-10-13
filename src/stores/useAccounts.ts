import { create } from "zustand";
import type { PlatformAdapter } from "@/platform/types";
import { applyAccentColor } from "@/lib/accent-color";
import type { AccountsState, StoreRuntime, StoreServices } from "./accounts/store-types";
export type { ViewMode } from "./accounts/store-types";
import { loadViewMode, loadSelectedGroup, loadAccentColor } from "./accounts/preferences";
import { createStorage } from "./accounts/storage";
import { createLoadActions } from "./accounts/load-actions";
import { createAccountActions } from "./accounts/account-actions";
import { createGroupActions } from "./accounts/group-actions";
import { createTrashActions } from "./accounts/trash-actions";
import { createPreferenceActions } from "./accounts/preferences";

let platform: PlatformAdapter;
let persistQueue: Promise<void> = Promise.resolve();

const runtime: StoreRuntime = {
  get platform() { return platform; },
  set platform(value) { platform = value; },
  get persistQueue() { return persistQueue; },
  set persistQueue(value) { persistQueue = value; },
};

const services: StoreServices = {
  normalizeGroups: (values) => createStorageInstance.normalizeGroups(values),
  readLegacyLocalGroups: () => createStorageInstance.readLegacyLocalGroups(),
  clearLegacyLocalGroups: () => createStorageInstance.clearLegacyLocalGroups(),
  persistGroups: (groups) => createStorageInstance.persistGroups(groups),
  persist: (accounts) => createStorageInstance.persist(accounts),
  persistTrash: (trash) => createStorageInstance.persistTrash(trash),
  loadFromStorage: () => createStorageInstance.loadFromStorage(),
  loadTrashFromStorage: () => createStorageInstance.loadTrashFromStorage(),
};

const createStorageInstance = createStorage(runtime);

export function initPlatform(adapter: PlatformAdapter) {
  platform = adapter;
  persistQueue = Promise.resolve();
}

const initialAccentColor = loadAccentColor();
applyAccentColor(initialAccentColor);

export const useAccounts = create<AccountsState>((set, get) => {
  const createLoadActionsInstance = createLoadActions(set, get, runtime, services);
  const createAccountActionsInstance = createAccountActions(set, get, services);
  const createGroupActionsInstance = createGroupActions(set, get, services);
  const createTrashActionsInstance = createTrashActions(set, get, services);
  const createPreferenceActionsInstance = createPreferenceActions(set, get);
  return {
    accounts: [],
    trash: [],
    groups: [],
    searchQuery: "",
    showAddForm: false,
    showDataTransfer: false,
    showTrash: false,
    isDark: localStorage.getItem("goose-2fa-dark") !== null
      ? localStorage.getItem("goose-2fa-dark") === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches,
    isThemeLocked: localStorage.getItem("goose-2fa-dark") !== null,
    editMode: false,
    viewMode: loadViewMode(),
    selectedGroup: loadSelectedGroup(),
    accentColor: initialAccentColor,
    loadStatus: "idle",
    loadError: null,
    load: createLoadActionsInstance.load,
    save: createAccountActionsInstance.save,
    setViewMode: createPreferenceActionsInstance.setViewMode,
    setSelectedGroup: createPreferenceActionsInstance.setSelectedGroup,
    setAccentColor: createPreferenceActionsInstance.setAccentColor,
    reorderAccounts: createAccountActionsInstance.reorderAccounts,
    addAccount: createAccountActionsInstance.addAccount,
    importAccounts: createAccountActionsInstance.importAccounts,
    updateNote: createAccountActionsInstance.updateNote,
    updateRemark: createAccountActionsInstance.updateRemark,
    updateAccountGroup: createAccountActionsInstance.updateAccountGroup,
    createGroup: createGroupActionsInstance.createGroup,
    renameGroup: createGroupActionsInstance.renameGroup,
    deleteGroup: createGroupActionsInstance.deleteGroup,
    reorderGroups: createGroupActionsInstance.reorderGroups,
    removeAccount: createTrashActionsInstance.removeAccount,
    restoreAccount: createTrashActionsInstance.restoreAccount,
    permanentlyDelete: createTrashActionsInstance.permanentlyDelete,
    emptyTrash: createTrashActionsInstance.emptyTrash,
    incrementCounter: createAccountActionsInstance.incrementCounter,
    setSearchQuery: createPreferenceActionsInstance.setSearchQuery,
    setShowAddForm: createPreferenceActionsInstance.setShowAddForm,
    setShowDataTransfer: createPreferenceActionsInstance.setShowDataTransfer,
    setShowTrash: createPreferenceActionsInstance.setShowTrash,
    toggleDark: createPreferenceActionsInstance.toggleDark,
    toggleThemeLock: createPreferenceActionsInstance.toggleThemeLock,
    syncSystemDark: createPreferenceActionsInstance.syncSystemDark,
    setEditMode: createPreferenceActionsInstance.setEditMode,
  };
});
