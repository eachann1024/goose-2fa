import { useCallback, useEffect, useRef, useState } from "react";
import { parseOtpAuthUri } from "@/lib/otp";
import { parseSecretInput } from "@/lib/secret-input";
import { parseGoogleAuthMigrationPayload } from "@/lib/google-auth-migration";
import { readQRFromClipboard, decodeQRFromBase64 } from "@/lib/qr-decode";
import { usePlatform } from "@/platform/context";
import type { NewAccountInput } from "@/lib/types";

interface AccountImportOptions {
  onAdd: (input: NewAccountInput) => void;
  onBatchAdd?: (inputs: NewAccountInput[]) => void;
  onSecretInput: (text: string) => void;
  initialAction?: "clipboard" | "capture";
}

export function useAccountImport({ onAdd, onBatchAdd, onSecretInput, initialAction }: AccountImportOptions) {
  const platform = usePlatform();
  const [importError, setImportError] = useState("");
  const mountedRef = useRef(true);
  // 自增标识：每次点击导入/截屏都 +1，旧回调若标识过期则丢弃
  const captureGenRef = useRef(0);
  const clipboardGenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Try to parse any decoded content (text or QR result) into accounts. */
  const processDecodedContent = useCallback(
    (content: string): boolean => {
      const trimmed = content.trim();

      // 1. otpauth:// single URI
      if (trimmed.startsWith("otpauth://")) {
        const parsed = parseOtpAuthUri(trimmed);
        if (parsed) {
          onAdd({ ...parsed });
          return true;
        }
        setImportError("无法解析此 OTP 链接");
        return true;
      }

      // 2. Google Authenticator migration
      if (trimmed.startsWith("otpauth-migration://")) {
        const migration = parseGoogleAuthMigrationPayload(trimmed);
        if (migration?.batchSize && migration.batchSize > 1) {
          setImportError(`这是第 ${migration.batchIndex + 1}/${migration.batchSize} 张迁移二维码。为避免漏账户，请在 Google Authenticator 中减少本次导出账户数量后重试。`);
          return true;
        }
        const entries = migration?.accounts;
        if (entries && entries.length > 0) {
          if (entries.length === 1) {
            onAdd(entries[0]!);
          } else if (onBatchAdd) {
            onBatchAdd(entries);
          } else {
            // fallback: add all one by one
            entries.forEach((e) => onAdd(e));
          }
          return true;
        }
        setImportError("无法解析 Google Authenticator 迁移数据");
        return true;
      }

      // 3. Plain base32 secret
      if (parseSecretInput(trimmed)) {
        onSecretInput(trimmed);
        setImportError("");
        return true; // 已填入密钥，等待用户补充名称后保存。
      }

      return false;
    },
    [onAdd, onBatchAdd, onSecretInput],
  );

  const handleClipboardImport = useCallback(async () => {
    const myGen = ++clipboardGenRef.current;
    setImportError("");

    const isStale = () => myGen !== clipboardGenRef.current || !mountedRef.current;

    try {
      // Read clipboard text
      const clipText = await platform.readClipboardText();

      // Try text content first
      if (clipText) {
        if (isStale()) return;
        if (processDecodedContent(clipText)) return;
      }

      // Try QR code image from clipboard
      const qrResult = await readQRFromClipboard(platform);
      if (isStale()) return;
      if (qrResult) {
        if (processDecodedContent(qrResult)) return;
        setImportError("二维码内容不是有效的 OTP 数据");
        return;
      }

      setImportError("剪贴板中未找到有效内容 (支持 otpauth 链接、迁移码、二维码图片或 Base32 密钥)");
    } catch {
      if (!isStale()) setImportError("读取剪贴板失败");
    }
  }, [processDecodedContent, platform]);

  const handleScreenCapture = useCallback(async () => {
    const myGen = ++captureGenRef.current;
    setImportError("");

    const isStale = () => myGen !== captureGenRef.current || !mountedRef.current;

    try {
      const base64 = await platform.captureScreen();
      if (isStale()) return;
      if (!base64) {
        setImportError("截屏已取消");
        return;
      }
      try {
        const qrResult = await decodeQRFromBase64(base64);
        if (isStale()) return;
        if (qrResult) {
          if (!processDecodedContent(qrResult)) {
            setImportError("截图中的二维码不是有效的 OTP 数据");
          }
        } else {
          setImportError("未在截图中检测到二维码");
        }
      } catch {
        if (!isStale()) setImportError("解析截图失败");
      }
    } catch {
      if (!isStale()) setImportError("截屏失败或被取消");
    }
  }, [processDecodedContent, platform]);

  // Auto-trigger initial action on mount
  const initialActionRef = useRef(initialAction);
  useEffect(() => {
    if (initialActionRef.current === "clipboard") {
      handleClipboardImport();
    } else if (initialActionRef.current === "capture") {
      handleScreenCapture();
    }
    initialActionRef.current = undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { importError, handleClipboardImport, handleScreenCapture };
}
