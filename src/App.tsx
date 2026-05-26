import { useEffect, useState, useCallback, useRef } from "react";
import { useAccounts } from "@/stores/useAccounts";
import { usePlatform } from "@/platform/context";
import { Header } from "@/components/Header";
import { CodeGrid } from "@/components/CodeGrid";
import { AddAccount } from "@/components/AddAccount";
import { DataTransfer } from "@/components/DataTransfer";
import { TrashBin } from "@/components/TrashBin";
import { AccountDetail } from "@/components/AccountDetail";
import type { AccountData } from "@/lib/types";

type FlipState = "idle" | "opening" | "open" | "closing";

export default function App() {
  const platform = usePlatform();
  const accounts = useAccounts((s) => s.accounts);
  const trash = useAccounts((s) => s.trash);
  const searchQuery = useAccounts((s) => s.searchQuery);
  const showAddForm = useAccounts((s) => s.showAddForm);
  const showDataTransfer = useAccounts((s) => s.showDataTransfer);
  const showTrash = useAccounts((s) => s.showTrash);
  const isDark = useAccounts((s) => s.isDark);
  const isThemeLocked = useAccounts((s) => s.isThemeLocked);
  const load = useAccounts((s) => s.load);
  const addAccount = useAccounts((s) => s.addAccount);
  const importAccounts = useAccounts((s) => s.importAccounts);
  const removeAccount = useAccounts((s) => s.removeAccount);
  const restoreAccount = useAccounts((s) => s.restoreAccount);
  const permanentlyDelete = useAccounts((s) => s.permanentlyDelete);
  const emptyTrash = useAccounts((s) => s.emptyTrash);
  const updateNote = useAccounts((s) => s.updateNote);
  const updateRemark = useAccounts((s) => s.updateRemark);
  const incrementCounter = useAccounts((s) => s.incrementCounter);
  const setSearchQuery = useAccounts((s) => s.setSearchQuery);
  const setShowAddForm = useAccounts((s) => s.setShowAddForm);
  const setShowDataTransfer = useAccounts((s) => s.setShowDataTransfer);
  const setShowTrash = useAccounts((s) => s.setShowTrash);
  const toggleDark = useAccounts((s) => s.toggleDark);
  const toggleThemeLock = useAccounts((s) => s.toggleThemeLock);
  const syncSystemDark = useAccounts((s) => s.syncSystemDark);

  const [addFormAction, setAddFormAction] = useState<"clipboard" | "capture" | undefined>();
  const [detailAccount, setDetailAccount] = useState<AccountData | null>(null);
  const [flipState, setFlipState] = useState<FlipState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    load();
    document.documentElement.classList.toggle("dark", useAccounts.getState().isDark);
  }, [load]);

  useEffect(() => {
    // uTools (Electron) 环境：监听 nativeTheme 派发的主题变化事件
    const handleThemeChanged = (e: CustomEvent<{ isDark: boolean }>) => {
      if (localStorage.getItem("goose-2fa-dark") === null) {
        syncSystemDark(e.detail.isDark);
      }
    };
    window.addEventListener("goose-2fa:theme-changed", handleThemeChanged as EventListener);

    // 浏览器开发环境兜底：matchMedia
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("goose-2fa-dark") === null) {
        syncSystemDark(e.matches);
      }
    };
    mq.addEventListener("change", mqHandler);

    return () => {
      window.removeEventListener("goose-2fa:theme-changed", handleThemeChanged as EventListener);
      mq.removeEventListener("change", mqHandler);
    };
  }, [syncSystemDark]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("goose-2fa:plugin-enter", handler);
    return () => window.removeEventListener("goose-2fa:plugin-enter", handler);
  }, [load]);

  const handleCopy = (_text: string) => {};

  const handleDetailCopy = (text: string) => {
    platform.copyText(text);
  };

  const handleOpenDetail = useCallback((account: AccountData) => {
    clearTimeout(timerRef.current);
    setDetailAccount(account);
    setFlipState("opening");
    timerRef.current = setTimeout(() => setFlipState("open"), 700);
  }, []);

  const handleCloseDetail = useCallback(() => {
    clearTimeout(timerRef.current);
    setFlipState("closing");
    timerRef.current = setTimeout(() => {
      setFlipState("idle");
      setDetailAccount(null);
    }, 700);
  }, []);

  const handleDeleteFromDetail = useCallback((id: string) => {
    clearTimeout(timerRef.current);
    setFlipState("closing");
    timerRef.current = setTimeout(() => {
      removeAccount(id);
      setFlipState("idle");
      setDetailAccount(null);
    }, 700);
  }, [removeAccount]);

  if (showTrash) {
    return (
      <div className="flex min-h-screen flex-col">
        <TrashBin
          trash={trash}
          onRestore={restoreAccount}
          onPermanentDelete={permanentlyDelete}
          onEmptyTrash={emptyTrash}
          onBack={() => setShowTrash(false)}
        />
      </div>
    );
  }

  if (showDataTransfer) {
    return (
      <div className="flex min-h-screen flex-col">
        <DataTransfer
          accounts={accounts}
          onImport={importAccounts}
          onCancel={() => setShowDataTransfer(false)}
        />
      </div>
    );
  }

  if (showAddForm) {
    return (
      <div className="flex min-h-screen flex-col">
        <AddAccount
          onAdd={addAccount}
          onBatchAdd={importAccounts}
          onCancel={() => { setShowAddForm(false); setAddFormAction(undefined); }}
          initialAction={addFormAction}
        />
      </div>
    );
  }

  const frontClass = [
    "flip-face flip-front flex flex-col bg-bg",
    flipState === "opening" ? "flipping-out" : "",
    flipState === "closing" ? "flipping-in" : "",
    flipState === "open" ? "pointer-events-none opacity-0" : "",
  ].join(" ");

  const backClass = [
    "flip-face flip-back",
    flipState === "opening" ? "flipping-in" : "",
    flipState === "closing" ? "flipping-out" : "",
    flipState === "idle" ? "pointer-events-none" : "",
    flipState === "open" ? "!transform-none !opacity-100" : "",
  ].join(" ");

  return (
    <div className="flip-scene">
      {/* 正面：主界面 */}
      <div className={frontClass}>
        <Header
          hasAccounts={accounts.length > 0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAdd={() => { setAddFormAction(undefined); setShowAddForm(true); }}
          onManageData={() => setShowDataTransfer(true)}
          onTrash={() => setShowTrash(true)}
          isDark={isDark}
          isThemeLocked={isThemeLocked}
          onToggleDark={toggleDark}
          onToggleThemeLock={toggleThemeLock}
          trashCount={trash.length}
        />
        <CodeGrid
          accounts={accounts}
          searchQuery={searchQuery}
          onCopy={handleCopy}
          onDetail={handleOpenDetail}
          onIncrement={incrementCounter}
          onAdd={() => { setAddFormAction(undefined); setShowAddForm(true); }}
          onClipboardImport={() => { setAddFormAction("clipboard"); setShowAddForm(true); }}
          onScreenCapture={() => { setAddFormAction("capture"); setShowAddForm(true); }}
        />
      </div>

      {/* 背面：详情 / 预热占位 */}
      {detailAccount ? (
        <div className={backClass}>
          <AccountDetail
            account={detailAccount}
            onClose={handleCloseDetail}
            onDelete={handleDeleteFromDetail}
            onCopy={handleDetailCopy}
            onUpdateNote={updateNote}
            onUpdateRemark={updateRemark}
          />
        </div>
      ) : (
        <div className="flip-face flip-back pointer-events-none" aria-hidden="true" />
      )}
    </div>
  );
}
