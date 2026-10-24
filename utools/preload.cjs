if (window.ztools) {
  window.utools = window.ztools
}

if (typeof window !== "undefined" && typeof utools !== "undefined") {
  window.utools = utools;

  const ACCOUNTS_KEY = "goose-2fa-accounts";
  const GROUPS_KEY = "goose-2fa-groups";
  /** 与 MCP 只读消费者保持一致的上限，超限按不可读处理而不是截断。 */
  const MAX_SYNC_BYTES = 5 * 1024 * 1024;
  const SYNC_LOCK_WAIT_MS = 250;

  const readJsonArray = (key, label) => {
    if (typeof utools?.dbStorage?.getItem !== "function") {
      throw new Error(`${label} storage unavailable`);
    }
    try {
      const raw = utools.dbStorage.getItem(key);
      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error(`${label} data invalid`);
        return parsed;
      }
      if (Array.isArray(raw)) return raw;
      if (raw == null) return [];
      throw new Error(`${label} data invalid`);
    } catch (err) {
      console.error(`[goose-2fa] read ${label} failed:`, err);
      throw err;
    }
  };

  const writeJsonArray = (key, value, label) => {
    try {
      if (typeof utools?.dbStorage?.setItem === "function") {
        utools.dbStorage.setItem(key, JSON.stringify(value));
        return true;
      }
    } catch (err) {
      console.error(`[goose-2fa] write ${label} failed:`, err);
    }
    return false;
  };

  const readAccounts = () => readJsonArray(ACCOUNTS_KEY, "accounts");
  const writeAccounts = (accounts) => writeJsonArray(ACCOUNTS_KEY, accounts, "accounts");
  const readGroups = () => readJsonArray(GROUPS_KEY, "groups");
  const writeGroups = (groups) => writeJsonArray(GROUPS_KEY, groups, "groups");

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

  // 分离窗口不受 hideMainWindow 影响：官方唯一能让它消失的是 outPlugin（分离模式下只退到后台、不杀进程），
  // 截完再用 redirect 回到本插件同一指令，uTools 会直接把原分离窗口拉回来。
  const DETACH_HIDE_DELAY = 220;
  const isDetached = () => {
    try {
      return utools?.getWindowType?.() === "detach";
    } catch {
      return false;
    }
  };

  // 与 utools/plugin.json 的 pluginName、2fa 指令保持一致
  const SELF_REDIRECT = ["鹅的验证", "2FA"];
  // 截屏这一轮自己触发的退出/重新进入不通知页面，否则页面会重新载入、丢掉正在等待的截图结果
  let selfCycleUntil = 0;
  const restoreDetached = () => {
    selfCycleUntil = Date.now() + 3000;
    try {
      utools?.redirect?.(SELF_REDIRECT);
    } catch (err) {
      console.error("[goose-2fa] restore detached window failed:", err);
    }
  };

  const captureScreen = (callback) => {
    try {
      if (typeof utools?.screenCapture === "function") {
        const detached = isDetached();
        let settled = false;
        const finish = (base64) => {
          if (settled) return;
          settled = true;
          if (detached) restoreDetached();
          else utools.showMainWindow();
          callback(base64 || null);
        };
        const start = () => utools.screenCapture((base64) => finish(base64));
        if (detached) {
          selfCycleUntil = Date.now() + 65000;
          utools.outPlugin();
          // 等窗口真正从屏幕上撤下再进入截屏，否则会把自己截进去
          setTimeout(start, DETACH_HIDE_DELAY);
        } else {
          utools.hideMainWindow();
          start();
        }
        // 兜底：截屏 60 秒无响应则恢复窗口
        setTimeout(() => finish(null), 60000);
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

  const getDefaultSyncPath = () => {
    const path = require("path");
    let documents;
    try { documents = utools.getPath?.("documents"); } catch {}
    if (typeof documents !== "string" || !path.isAbsolute(documents)) {
      documents = path.join(require("os").homedir(), "Documents");
    }
    return resolveSyncPath(path.join(documents, "goose-2fa.json"));
  };

  const selectSyncPath = (mode = "new") => {
    try {
      if (mode === "existing") {
        const files = utools.showOpenDialog({
          title: "选择已有数据源文件",
          buttonLabel: "选择",
          filters: [{ name: "JSON 文件", extensions: ["json"] }],
          properties: ["openFile"],
        });
        return files?.[0] || null;
      }
      const filePath = utools.showSaveDialog({
        title: "新建数据源文件",
        defaultPath: getDefaultSyncPath(),
        buttonLabel: "新建",
        filters: [{ name: "JSON 文件", extensions: ["json"] }],
      });
      if (filePath && require("fs").existsSync(filePath)) {
        utools.showNotification?.("该文件已经存在，请使用「选择已有文件」");
        return null;
      }
      return filePath || null;
    } catch (err) {
      console.error("[goose-2fa] select sync path failed:", err);
      return null;
    }
  };

  const readSyncFile = (filePath) => {
    try {
      const fs = require("fs");
      const path = require("path");
      if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
        return { ok: false, reason: "unreadable" };
      }
      // 真实路径守卫：别名路径会给自己一把新锁，宁可拒绝也不能出现两个写入端。
      if (resolveSyncPath(filePath) !== filePath) return { ok: false, reason: "unresolved" };
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (err) {
        return { ok: false, reason: err && err.code === "ENOENT" ? "missing" : "unreadable" };
      }
      if (!stats.isFile()) return { ok: false, reason: "unreadable" };
      if (stats.size > MAX_SYNC_BYTES) return { ok: false, reason: "too-large" };
      return {
        ok: true,
        content: fs.readFileSync(filePath, "utf8"),
        mtimeMs: stats.mtimeMs,
        size: stats.size,
      };
    } catch (err) {
      console.error("[goose-2fa] read sync file failed:", err);
      return { ok: false, reason: "unreadable" };
    }
  };

  /**
   * 把路径解析到真实文件/真实父目录，让 `~/x.json` 与经符号链接的同一文件落到同一把锁。
   * 文件不存在时按真实父目录 + 文件名解析；父目录也不存在则原样返回（写入会因 io 失败）。
   */
  const resolveSyncPath = (input) => {
    try {
      const fs = require("fs");
      const path = require("path");
      if (typeof input !== "string" || !path.isAbsolute(input)) return input;
      try {
        if (fs.statSync(input).isFile()) return fs.realpathSync.native(input);
      } catch {}
      try {
        return path.join(fs.realpathSync.native(path.dirname(input)), path.basename(input));
      } catch {
        return input;
      }
    } catch (err) {
      console.error("[goose-2fa] resolve sync path failed:", err);
      return input;
    }
  };

  /** 读取锁文件原始内容；没有锁文件返回 null。仅供上层向用户报告，不用来自动清理。 */
  const readSyncLock = (lockPath) => {
    try {
      return require("fs").readFileSync(lockPath, "utf8");
    } catch {
      return null;
    }
  };

  /** 用户显式清理残留锁；这里只删锁文件，不代替用户重试写入。 */
  const clearSyncLock = (lockPath) => {
    try {
      const fs = require("fs");
      const path = require("path");
      if (typeof lockPath !== "string" || !path.isAbsolute(lockPath)) return false;
      fs.unlinkSync(lockPath);
      return true;
    } catch (err) {
      console.error("[goose-2fa] clear sync lock failed:", err);
      return false;
    }
  };

  /**
   * 数据源文件写锁：与 Raycast 端共用 `shared/sync-protocol.ts` 的命名与等待预算，
   * 锁路径由渲染层算好传进来，这里只负责拿到/释放，不再自己拼名字。
   * 绝不按 mtime 判「过期」删锁：删掉活锁会让两个写入端同时写同一个文件。
   */
  const acquireSyncLock = (lockPath) => {
    const fs = require("fs");
    const deadline = Date.now() + SYNC_LOCK_WAIT_MS;
    for (;;) {
      try {
        fs.writeFileSync(lockPath, `${process.pid}\n${Date.now()}\n`, { flag: "wx", mode: 0o600 });
        return true;
      } catch (err) {
        if (!err || err.code !== "EEXIST") {
          console.error("[goose-2fa] acquire sync lock failed:", err);
          return false;
        }
      }
      if (Date.now() >= deadline) return false;
      const until = Date.now() + 20;
      while (Date.now() < until) { /* preload 运行在同步上下文，只能短暂忙等 */ }
    }
  };

  const releaseSyncLock = (lockPath) => {
    try {
      require("fs").unlinkSync(lockPath);
    } catch {}
  };

  /**
   * 原子写入数据源文件，返回写入后的 stat（调用方用它更新基线）。
   * expectedContent 非 null 时在锁内逐字节比对当前内容，不一致即 conflict：mtime/size 不是版本依据。
   */
  const writeSyncFile = (filePath, content, lockPath, expectedContent, createOnly = false) => {
    let tempPath = null;
    let holdingLock = false;
    try {
      const fs = require("fs");
      const path = require("path");
      if (typeof filePath !== "string" || !path.isAbsolute(filePath) || typeof content !== "string") {
        return { ok: false, reason: "invalid" };
      }
      // 真实路径守卫：别名路径会给自己一把新锁，宁可拒绝也不能出现两个写入端。
      if (resolveSyncPath(filePath) !== filePath) return { ok: false, reason: "unresolved" };
      if (typeof lockPath === "string" && lockPath) {
        if (!path.isAbsolute(lockPath)) return { ok: false, reason: "invalid" };
        if (!acquireSyncLock(lockPath)) {
          return { ok: false, reason: "locked", lockContent: readSyncLock(lockPath) };
        }
        holdingLock = true;
      }
      if (createOnly && fs.existsSync(filePath)) return { ok: false, reason: "conflict" };
      if (typeof expectedContent === "string") {
        let current = null;
        try {
          current = fs.readFileSync(filePath, "utf8");
        } catch {
          current = null;
        }
        if (current === null || current !== expectedContent) {
          return { ok: false, reason: "conflict" };
        }
      }
      const directory = path.dirname(filePath);
      tempPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${require("crypto").randomUUID()}.tmp`);
      const fd = fs.openSync(tempPath, "wx", 0o600);
      try {
        fs.writeFileSync(fd, content, { encoding: "utf-8" });
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tempPath, filePath);
      tempPath = null;
      const written = fs.statSync(filePath);
      return { ok: true, mtimeMs: written.mtimeMs, size: written.size };
    } catch (err) {
      if (tempPath) {
        try { require("fs").unlinkSync(tempPath); } catch {}
      }
      console.error("[goose-2fa] write sync file failed:", err);
      return { ok: false, reason: "io" };
    } finally {
      if (holdingLock) releaseSyncLock(lockPath);
    }
  };

  /** 子搜索框 handler，由 React 侧通过 window.goose2fa.setSubInput 注册。 */
  let subInputHandler = null;
  const safeCall = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (err) {
      console.error("[goose-2fa] utools api failed:", err);
    }
    return undefined;
  };

  window.goose2fa = {
    loadAccounts: readAccounts,
    saveAccounts: writeAccounts,
    loadGroups: readGroups,
    saveGroups: writeGroups,
    copyText: (text) => {
      safeCall(utools?.copyText, text);
    },
    showNotification: (text) => {
      safeCall(utools?.showNotification, text);
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
    getDefaultSyncPath,
    selectSyncPath,
    resolveSyncPath,
    clearSyncLock,
    readSyncFile,
    writeSyncFile,
    hideWindow: () => {
      safeCall(utools?.hideMainWindow);
    },
    showWindow: () => {
      safeCall(utools?.showMainWindow);
    },

    /** uTools 子搜索框 API 包装 */
    setSubInput: (handler, placeholder, initial) => {
      subInputHandler = typeof handler === "function" ? handler : null;
      const ok = safeCall(
        utools?.setSubInput,
        ({ text }) => {
          if (subInputHandler) subInputHandler(text || "");
        },
        placeholder || "搜索账户...",
        true,
      );
      if (typeof initial === "string" && initial.length > 0) {
        safeCall(utools?.setSubInputValue, initial);
      }
      return ok === true;
    },
    removeSubInput: () => {
      subInputHandler = null;
      safeCall(utools?.removeSubInput);
    },
    /** 粘贴到上一个聚焦窗口；返回 boolean */
    pasteText: (text) => {
      const ok = safeCall(utools?.hideMainWindowPasteText, text);
      return ok === true;
    },
    /** 模拟键盘输入（防剪贴板被监听场景） */
    typeString: (text) => {
      const ok = safeCall(utools?.hideMainWindowTypeString, text);
      return ok === true;
    },
    outPlugin: () => {
      safeCall(utools?.outPlugin);
    },
  };

  utools.onPluginEnter(({ code, type, payload }) => {
    if (Date.now() < selfCycleUntil) {
      selfCycleUntil = 0;
      return;
    }
    window.dispatchEvent(
      new CustomEvent("goose-2fa:plugin-enter", {
        detail: { code, type, payload },
      }),
    );
  });

  if (typeof utools.onPluginOut === "function") {
    utools.onPluginOut(() => {
      if (Date.now() < selfCycleUntil) return;
      subInputHandler = null;
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
