import { useState, useCallback, useEffect, useRef } from "react";
import {
  exportAsJson,
  exportAsUris,
  parseImportBundle,
  deduplicateImports,
} from "@/lib/data-transfer";
import { usePlatform } from "@/platform/context";
import type { AccountData, NewAccountInput, VaultGroup } from "@/lib/types";
import { ImportPreview } from "./ImportPreview";
import { ImportDone } from "./ImportDone";
import { TransferMenu } from "./TransferMenu";

interface DataTransferProps {
  accounts: AccountData[];
  groups: VaultGroup[];
  onImport: (inputs: NewAccountInput[], groups?: VaultGroup[]) => void;
  onCancel: () => void;
}

type ViewStep =
  | { kind: "menu" }
  | { kind: "preview"; fresh: NewAccountInput[]; groups: VaultGroup[]; dupes: number }
  | { kind: "done"; count: number };

export function DataTransfer({ accounts, groups, onImport, onCancel }: DataTransferProps) {
  const platform = usePlatform();
  const [view, setView] = useState<ViewStep>({ kind: "menu" });
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const flashCopied = useCallback(() => {
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  }, []);

  const flashExported = useCallback(() => {
    setExported(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setExported(false), 1500);
  }, []);

  const handleExportFile = useCallback(async () => {
    setError("");
    try {
      const json = exportAsJson(accounts, groups);
      const ok = await platform.saveToFile(
        json,
        `goose-2fa-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      if (ok) flashExported();
    } catch {
      setError("备份保存失败，请检查文件权限后重试");
    }
  }, [accounts, flashExported, groups, platform]);

  const handleCopyUris = useCallback(async () => {
    setError("");
    try {
      const uris = exportAsUris(accounts);
      await platform.copyText(uris);
      flashCopied();
    } catch {
      setError("复制失败，请检查剪贴板权限后重试");
    }
  }, [accounts, flashCopied, platform]);

  const processImportText = useCallback(
    (text: string) => {
      setError("");
      const bundle = parseImportBundle(text);
      if (!bundle || bundle.accounts.length === 0) {
        setError("未找到有效的账户数据");
        return;
      }
      const { newAccounts, dupeCount } = deduplicateImports(bundle.accounts, accounts);
      if (newAccounts.length === 0) {
        setError(`所有 ${dupeCount} 个账户已存在`);
        return;
      }
      setView({ kind: "preview", fresh: newAccounts, groups: bundle.groups, dupes: dupeCount });
    },
    [accounts],
  );

  const handleOpenFile = useCallback(async () => {
    setError("");
    try {
      const content = await platform.readFromFile();
      if (content) processImportText(content);
    } catch {
      setError("读取备份文件失败");
    }
  }, [processImportText, platform]);

  const handleClipboardImport = useCallback(async () => {
    setError("");
    try {
      const text = await platform.readClipboardText();
      if (!text.trim()) {
        setError("剪贴板为空");
        return;
      }
      processImportText(text);
    } catch {
      setError("读取剪贴板失败");
    }
  }, [processImportText, platform]);

  const handleConfirmImport = useCallback(() => {
    if (view.kind !== "preview") return;
    onImport(view.fresh, view.groups);
    setView({ kind: "done", count: view.fresh.length });
  }, [view, onImport]);

  const handleCancelPreview = useCallback(() => {
    setView({ kind: "menu" });
    setError("");
  }, []);

  if (view.kind === "preview") {
    return (
      <ImportPreview
        accounts={view.fresh}
        duplicates={view.dupes}
        onCancel={handleCancelPreview}
        onConfirm={handleConfirmImport}
      />
    );
  }

  if (view.kind === "done") {
    return <ImportDone count={view.count} onDone={onCancel} />;
  }

  return (
    <TransferMenu
      accountCount={accounts.length}
      copied={copied}
      exported={exported}
      error={error}
      onCancel={onCancel}
      onExportFile={handleExportFile}
      onCopyUris={handleCopyUris}
      onOpenFile={handleOpenFile}
      onClipboardImport={handleClipboardImport}
    />
  );
}
