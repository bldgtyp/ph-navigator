import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { apiUrl, fetchServiceStatus, type ServiceStatus } from "./api";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: ServiceStatus }
  | { status: "error"; message: string };

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  const loadStatus = useCallback((signal: AbortSignal) => {
    setLoadState({ status: "loading" });
    void fetchServiceStatus(signal)
      .then((data) => {
        setLoadState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Unknown backend error";
        setLoadState({ status: "error", message });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadStatus(controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  const handleRefresh = () => {
    const controller = new AbortController();
    loadStatus(controller.signal);
  };

  return (
    <main className="app-shell">
      <section className="status-page" aria-labelledby="page-title">
        <header className="status-header">
          <p className="eyebrow">TB-00 boot tracer</p>
          <h1 id="page-title">PH-Navigator V2</h1>
        </header>

        <div className="status-grid">
          <section className="status-panel" aria-live="polite">
            <h2>Backend service</h2>
            {loadState.status === "loading" ? <p>Checking backend status...</p> : null}
            {loadState.status === "error" ? (
              <div className="status-error" role="alert">
                <strong>Backend unavailable</strong>
                <span>{loadState.message}</span>
              </div>
            ) : null}
            {loadState.status === "ready" ? (
              <dl className="status-list">
                <div className="status-row">
                  <dt>Status</dt>
                  <dd>
                    <span className="status-badge">{loadState.data.health.status}</span>
                  </dd>
                </div>
                <div className="status-row">
                  <dt>Service</dt>
                  <dd>{loadState.data.health.service}</dd>
                </div>
                <div className="status-row">
                  <dt>Phase</dt>
                  <dd>{loadState.data.health.phase}</dd>
                </div>
                <div className="status-row">
                  <dt>API</dt>
                  <dd>{loadState.data.version.api_version}</dd>
                </div>
                <div className="status-row">
                  <dt>App version</dt>
                  <dd>{loadState.data.version.app_version}</dd>
                </div>
                <div className="status-row">
                  <dt>Environment</dt>
                  <dd>{loadState.data.version.environment}</dd>
                </div>
              </dl>
            ) : null}

            <div className="status-actions">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loadState.status === "loading"}
              >
                Refresh
              </button>
              <a className="status-link" href={apiUrl("/api/v1/health")} rel="noreferrer">
                Open health JSON
              </a>
            </div>
          </section>

          <aside className="status-panel">
            <h2>Next slice</h2>
            <p>TB-01 adds editor sign-in and the empty dashboard shell.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
