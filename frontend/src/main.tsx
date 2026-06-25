import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

async function enableReactScan() {
  if (!import.meta.env.DEV || import.meta.env.VITE_REACT_SCAN !== "true") return;
  const { scan } = await import("react-scan");
  scan({ enabled: true });
}

void enableReactScan().catch((error: unknown) => {
  // React Scan is opt-in dev instrumentation; failures must not block the app.
  console.warn("React Scan failed to start.", error);
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
