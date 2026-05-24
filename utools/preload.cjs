if (typeof window !== "undefined" && typeof utools !== "undefined") {
  window.utools = utools;

  const STORAGE_KEY = "goose-2fa-accounts";

  const readAccounts = () => {
    try {
      if (typeof utools?.dbStorage?.getItem === "function") {
        const raw = utools.dbStorage.getItem(STORAGE_KEY);
        if (typeof raw === "string") return JSON.parse(raw);
      }
    } catch (err) {
      console.error("[goose-2fa] read accounts failed:", err);
    }
    return [];
  };

  const writeAccounts = (accounts) => {
    try {
      if (typeof utools?.dbStorage?.setItem === "function") {
        utools.dbStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
        return true;
      }
    } catch (err) {
      console.error("[goose-2fa] write accounts failed:", err);
    }
    return false;
  };

  const readClipboardImage = () => {
    try {
      const electron = require("electron");
      if (!electron || !electron.clipboard) return null;
      const img = electron.clipboard.readImage();
      if (!img || img.isEmpty()) return null;
      const { width, height } = img.getSize();
      const bitmap = img.toBitmap();
      const rgba = new Uint8ClampedArray(bitmap.length);
      for (let i = 0; i < bitmap.length; i += 4) {
        rgba[i] = bitmap[i + 2];
        rgba[i + 1] = bitmap[i + 1];
        rgba[i + 2] = bitmap[i];
        rgba[i + 3] = bitmap[i + 3];
      }
      return { width, height, data: Array.from(rgba) };
    } catch (err) {
      console.error("[goose-2fa] read clipboard image failed:", err);
      return null;
    }
  };

  const captureScreen = (callback) => {
    try {
      if (typeof utools?.screenCapture === "function") {
        let settled = false;
        utools.hideMainWindow();
        utools.screenCapture((base64) => {
          if (settled) return;
          settled = true;
          utools.showMainWindow();
          callback(base64 || null);
        });
        // 兜底：截屏 60 秒无响应则恢复窗口
        setTimeout(() => {
          if (settled) return;
          settled = true;
          utools.showMainWindow();
          callback(null);
        }, 60000);
        return true;
      }
    } catch (err) {
      console.error("[goose-2fa] screen capture failed:", err);
    }
    return false;
  };

  const saveToFile = (content, defaultName) => {
    try {
      const fs = require("fs");
      const filePath = utools.showSaveDialog({
        title: "导出备份",
        defaultPath: defaultName,
        buttonLabel: "保存",
        filters: [{ name: "JSON 文件", extensions: ["json"] }],
      });
      if (!filePath) return false;
      fs.writeFileSync(filePath, content, "utf-8");
      return true;
    } catch (err) {
      console.error("[goose-2fa] save file failed:", err);
      return false;
    }
  };

  const readFromFile = () => {
    try {
      const fs = require("fs");
      const paths = utools.showOpenDialog({
        title: "导入备份",
        buttonLabel: "选择",
        filters: [{ name: "备份文件", extensions: ["json", "txt"] }],
        properties: ["openFile"],
      });
      if (!paths || paths.length === 0) return null;
      return fs.readFileSync(paths[0], "utf-8");
    } catch (err) {
      console.error("[goose-2fa] read file failed:", err);
      return null;
    }
  };

  window.goose2fa = {
    loadAccounts: readAccounts,
    saveAccounts: writeAccounts,
    copyText: (text) => {
      if (typeof utools?.copyText === "function") {
        utools.copyText(text);
      }
    },
    showNotification: (text) => {
      if (typeof utools?.showNotification === "function") {
        utools.showNotification(text);
      }
    },
    readClipboardImage,
    readClipboardText: () => {
      try {
        const electron = require("electron");
        if (electron?.clipboard) {
          return electron.clipboard.readText() || "";
        }
      } catch {}
      return "";
    },
    captureScreen,
    saveToFile,
    readFromFile,
    hideWindow: () => {
      if (typeof utools?.hideMainWindow === "function") {
        utools.hideMainWindow();
      }
    },
    showWindow: () => {
      if (typeof utools?.showMainWindow === "function") {
        utools.showMainWindow();
      }
    },
  };

  utools.onPluginEnter(({ code }) => {
    window.dispatchEvent(
      new CustomEvent("goose-2fa:plugin-enter", { detail: { code } }),
    );
  });

  if (typeof utools.onPluginOut === "function") {
    utools.onPluginOut(() => {
      window.dispatchEvent(new CustomEvent("goose-2fa:plugin-out"));
    });
  }

  // 监听系统主题变化（Electron nativeTheme）
  try {
    const { nativeTheme } = require("electron");
    if (nativeTheme) {
      nativeTheme.on("updated", () => {
        window.dispatchEvent(
          new CustomEvent("goose-2fa:theme-changed", {
            detail: { isDark: nativeTheme.shouldUseDarkColors },
          }),
        );
      });
    }
  } catch (err) {
    console.error("[goose-2fa] nativeTheme listener failed:", err);
  }
}
