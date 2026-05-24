import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initPlatform } from "@/stores/useAccounts";
import { PlatformProvider } from "@/platform/context";
import type { PlatformAdapter } from "@/platform/types";
import "./index.css";

async function createAdapter(): Promise<PlatformAdapter> {
  if (window.goose2fa) {
    const { createUToolsAdapter } = await import("./platform/utools");
    return createUToolsAdapter();
  }
  if ((window as any).__TAURI_INTERNALS__) {
    const { createTauriAdapter } = await import("./platform/tauri");
    return createTauriAdapter();
  }
  const { createWebAdapter } = await import("./platform/web");
  return createWebAdapter();
}

async function bootstrap() {
  const adapter = await createAdapter();
  initPlatform(adapter);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PlatformProvider adapter={adapter}>
        <App />
      </PlatformProvider>
    </StrictMode>,
  );
}

bootstrap();
