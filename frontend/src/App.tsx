/**
 * App entrypoint — scaffold only.
 *
 * Real routes (sign-in, dashboard, project view, catalog, model viewer)
 * land during feature work. This placeholder exists so `make frontend`
 * serves something and Playwright MCP has a target to drive.
 */
export function App() {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

  return (
    <main
      style={{
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "2rem",
        maxWidth: "44rem",
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      <h1>PH-Navigator V2</h1>
      <p>
        Scaffold. The real app is built incrementally per <code>docs/plans/user-stories.md</code>.
      </p>
      <p>
        Backend health check:{" "}
        <a href={`${apiBase}/api/health`} rel="noreferrer">
          {apiBase}/api/health
        </a>
      </p>
    </main>
  );
}
