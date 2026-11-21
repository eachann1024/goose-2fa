import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initPlatform, useAccounts } from "@/stores/useAccounts";
import { PlatformProvider } from "@/platform/context";
import type { PlatformAdapter } from "@/platform/types";
import { initAppTelemetry } from "@/lib/analytics";
import "./index.css";

async function createAdapter(): Promise<PlatformAdapter> {
  if (window.goose2fa) {
    const { createUToolsAdapter } = await import("./platform/utools");
    return createUToolsAdapter();
  }
  const { createWebAdapter } = await import("./platform/web");
  return createWebAdapter();
}

async function bootstrap() {
  const adapter = await createAdapter();
  initPlatform(adapter);
  initAppTelemetry(() => (useAccounts.getState().isDark ? "dark" : "light"));

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PlatformProvider adapter={adapter}>
        <App />
      </PlatformProvider>
    </StrictMode>,
  );
}

bootstrap();
