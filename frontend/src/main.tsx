import { Profiler, StrictMode } from "react";
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

const app = <App />;
const profiledApp =
  import.meta.env.DEV && window.__PHN_ENABLE_REACT_PROFILER__ === true ? (
    <Profiler
      id="PHNavigator"
      onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        window.__PHN_REACT_PROFILER__?.push({
          id,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        });
      }}
    >
      {app}
    </Profiler>
  ) : (
    app
  );

createRoot(rootEl).render(<StrictMode>{profiledApp}</StrictMode>);

declare global {
  interface Window {
    __PHN_ENABLE_REACT_PROFILER__?: boolean;
    __PHN_REACT_PROFILER__?: Array<{
      id: string;
      phase: "mount" | "update" | "nested-update";
      actualDuration: number;
      baseDuration: number;
      startTime: number;
      commitTime: number;
    }>;
  }
}
