import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAccounts } from "@/stores/useAccounts";
import { usePlatform } from "@/platform/context";
import { Header } from "@/components/Header";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { CodeGrid } from "@/components/CodeGrid";
import { AddAccount } from "@/components/AddAccount";
import { DataTransfer } from "@/components/DataTransfer";
import { TrashBin } from "@/components/TrashBin";
import { QuickCode } from "@/components/QuickCode";
import { VaultLoadState } from "@/components/VaultLoadState";
import { Toast } from "@/components/Toast";
import { DetailLayer } from "@/components/DetailLayer";
import type { AccountData } from "@/lib/types";
import { checkFeedbackUnread } from "@/lib/feedback";
import { useHostTheme, usePluginSession } from "@/lib/use-host-session";
import { listFaceClass, type ViewState } from "@/lib/view-transition";

export default function App() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const platform = usePlatform();
  const accounts = useAccounts((s) => s.accounts);
  const trash = useAccounts((s) => s.trash);
  const groups = useAccounts((s) => s.groups);
  const searchQuery = useAccounts((s) => s.searchQuery);
  const notice = useAccounts((s) => s.notice);
  const editMode = useAccounts((s) => s.editMode);
  const setEditMode = useAccounts((s) => s.setEditMode);
  const setNotice = useAccounts((s) => s.setNotice);
  const showAddForm = useAccounts((s) => s.showAddForm);
  const showDataTransfer = useAccounts((s) => s.showDataTransfer);
  const showTrash = useAccounts((s) => s.showTrash);
  const isDark = useAccounts((s) => s.isDark);
  const isThemeLocked = useAccounts((s) => s.isThemeLocked);
  const viewMode = useAccounts((s) => s.viewMode);
  const setViewMode = useAccounts((s) => s.setViewMode);
  const selectedGroup = useAccounts((s) => s.selectedGroup);
  const groupOrder = useAccounts((s) => s.groupOrder);
  const setSelectedGroup = useAccounts((s) => s.setSelectedGroup);
  const accentColor = useAccounts((s) => s.accentColor);
  const loadStatus = useAccounts((s) => s.loadStatus);
  const loadError = useAccounts((s) => s.loadError);
  const setAccentColor = useAccounts((s) => s.setAccentColor);
  const reorderAccounts = useAccounts((s) => s.reorderAccounts);
  const reorderGroups = useAccounts((s) => s.reorderGroups);
  const load = useAccounts((s) => s.load);
  const addAccount = useAccounts((s) => s.addAccount);
  const importAccounts = useAccounts((s) => s.importAccounts);
  const removeAccount = useAccounts((s) => s.removeAccount);
  const restoreAccount = useAccounts((s) => s.restoreAccount);
  const permanentlyDelete = useAccounts((s) => s.permanentlyDelete);
  const emptyTrash = useAccounts((s) => s.emptyTrash);
  const updateNote = useAccounts((s) => s.updateNote);
  const updateRemark = useAccounts((s) => s.updateRemark);
  const updateAccountGroup = useAccounts((s) => s.updateAccountGroup);
  const createGroup = useAccounts((s) => s.createGroup);
  const renameGroup = useAccounts((s) => s.renameGroup);
  const deleteGroup = useAccounts((s) => s.deleteGroup);
  const incrementCounter = useAccounts((s) => s.incrementCounter);
  const removeAccounts = useAccounts((s) => s.removeAccounts);
  const moveAccounts = useAccounts((s) => s.moveAccounts);
  const setSearchQuery = useAccounts((s) => s.setSearchQuery);
  const setShowAddForm = useAccounts((s) => s.setShowAddForm);
  const setShowDataTransfer = useAccounts((s) => s.setShowDataTransfer);
  const setShowTrash = useAccounts((s) => s.setShowTrash);
  const setThemeMode = useAccounts((s) => s.setThemeMode);
  const syncSystemDark = useAccounts((s) => s.syncSystemDark);

  const [addFormAction, setAddFormAction] = useState<"clipboard" | "capture" | undefined>();
  const [detailAccount, setDetailAccount] = useState<AccountData | null>(null);
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [quickMode, setQuickMode] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const focusReturnRef = useRef<HTMLElement | null>(null);

  // 与 index.css 景深淡入的时长 + 延迟对齐
  const transitionDelay = (phase: "open" | "close") =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : phase === "open" ? 450 : 360;

  useEffect(() => {
    load();
    document.documentElement.classList.toggle("dark", useAccounts.getState().isDark);
  }, [load]);

  useHostTheme(syncSystemDark);
  usePluginSession(load, setSearchQuery, setQuickQuery, setQuickMode);

  useEffect(() => {
    const tick = () => { void checkFeedbackUnread("2fa"); };
    tick();
    const timer = setInterval(tick, 60000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), [setNotice]);

  const handleCopy = (_text: string) => {};

  const handleDetailCopy = async (text: string) => {
    try {
      await platform.copyText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleOpenDetail = useCallback((account: AccountData) => {
    clearTimeout(timerRef.current);
    focusReturnRef.current = document.activeElement as HTMLElement | null;
    setDetailAccount(account);
    setViewState("opening");
    timerRef.current = setTimeout(() => setViewState("open"), transitionDelay("open"));
  }, []);

  const handleCloseDetail = useCallback(() => {
    clearTimeout(timerRef.current);
    setViewState("closing");
    timerRef.current = setTimeout(() => {
      setViewState("idle");
      setDetailAccount(null);
      focusReturnRef.current?.focus();
    }, transitionDelay("close"));
  }, []);

  const handleDeleteFromDetail = useCallback((id: string) => {
    clearTimeout(timerRef.current);
    // 趁详情还盖着列表时先删（列表重排、本地写入、同步都在这一刻完成），
    // 等这帧画完再起返回动画，避免重活和动画挤在一起掉帧、列表在眼前跳动。
    const latest = useAccounts.getState().accounts.find((a) => a.id === id);
    if (latest) setDetailAccount(latest);
    removeAccount(id);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setViewState("closing");
      timerRef.current = setTimeout(() => {
        setViewState("idle");
        setDetailAccount(null);
      }, transitionDelay("close"));
    }));
  }, [removeAccount]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // 打开详情时跟随 store 最新账户（改分组/备注后立即反映）。
  // 必须位于所有条件返回之前，保证每次渲染的 Hook 顺序一致。
  const liveDetail = useMemo(() => {
    if (!detailAccount) return null;
    return accounts.find((a) => a.id === detailAccount.id) ?? detailAccount;
  }, [accounts, detailAccount]);

  if (loadStatus !== "ready") {
    return (
      <VaultLoadState
        status={loadStatus}
        message={loadError}
        onRetry={load}
      />
    );
  }

  if (quickMode) {
    return (
      <QuickCode
        accounts={accounts}
        initialQuery={quickQuery}
        onIncrement={incrementCounter}
      />
    );
  }

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
          groups={groups}
          onImport={importAccounts}
          onCancel={() => setShowDataTransfer(false)}
        />
        <Toast notice={notice} onDismiss={dismissNotice} raised={editMode} />
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
        <Toast notice={notice} onDismiss={dismissNotice} raised={editMode} />
      </div>
    );
  }

  const frontClass = listFaceClass(viewState);

  return (
    <div className="view-scene">
      {/* 正面：主界面 */}
      <div
        className={frontClass}
        inert={viewState === "open" ? true : undefined}
        aria-hidden={viewState === "open"}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <Header
            hasAccounts={accounts.length > 0}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAdd={() => { setAddFormAction(undefined); setShowAddForm(true); }}
            batchMode={editMode}
            onBatchManage={() => { setSearchQuery(""); setEditMode(true); }}
            onManageData={() => setShowDataTransfer(true)}
            onTrash={() => setShowTrash(true)}
            onFeedback={() => setFeedbackOpen(true)}
            themeMode={isThemeLocked ? (isDark ? "dark" : "light") : "system"}
            onThemeModeChange={setThemeMode}
            accentColor={accentColor}
            onAccentColorChange={setAccentColor}
            trashCount={trash.length}
          />
          <CodeGrid
            accounts={accounts}
            groups={groups}
            searchQuery={searchQuery}
            viewMode={viewMode}
            selectedGroup={selectedGroup}
            groupOrder={groupOrder}
            onSelectGroup={setSelectedGroup}
            onCreateGroup={createGroup}
            onRenameGroup={renameGroup}
            onDeleteGroup={deleteGroup}
            onCopy={handleCopy}
            onDetail={handleOpenDetail}
            onIncrement={incrementCounter}
            onReorder={reorderAccounts}
            onReorderGroups={reorderGroups}
            onMoveToGroup={updateAccountGroup}
            onAdd={() => { setAddFormAction(undefined); setShowAddForm(true); }}
            onClipboardImport={() => { setAddFormAction("clipboard"); setShowAddForm(true); }}
            onScreenCapture={() => { setAddFormAction("capture"); setShowAddForm(true); }}
            batchMode={editMode}
            onExitBatch={() => setEditMode(false)}
            onRemoveMany={removeAccounts}
            onMoveMany={moveAccounts}
          />
        </div>
      </div>

      <DetailLayer
        account={liveDetail}
        viewState={viewState}
        groups={groups}
        onClose={handleCloseDetail}
        onDelete={handleDeleteFromDetail}
        onCopy={handleDetailCopy}
        onUpdateNote={updateNote}
        onUpdateRemark={updateRemark}
        onUpdateGroup={updateAccountGroup}
      />
      {feedbackOpen ? <FeedbackSheet onClose={() => setFeedbackOpen(false)} /> : null}
      <Toast notice={notice} onDismiss={dismissNotice} raised={editMode} />
    </div>
  );
}
