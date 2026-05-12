import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import "./App.css";
import { fetchCurrentSession, signIn, signOut, type AuthSession } from "./api";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: AuthSession }
  | { status: "error" };

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          path="/dashboard"
          element={<RequireAuth>{(session) => <Dashboard session={session} />}</RequireAuth>}
        />
        <Route path="/" element={<RootRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function RootRoute() {
  return <RequireAuth>{() => <Navigate to="/dashboard" replace />}</RequireAuth>;
}

function RequireAuth({ children }: { children: (session: AuthSession) => ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const location = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: "loading" });
    void fetchCurrentSession(controller.signal)
      .then((data) => {
        setLoadState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState({ status: "error" });
      });
    return () => controller.abort();
  }, [location.key]);

  if (loadState.status === "loading") {
    return <ShellMessage title="Checking session" message="Loading dashboard..." />;
  }

  if (loadState.status === "error") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }

  return children(loadState.data);
}

function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const destination = next === "/" ? "/dashboard" : next;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    void signIn(email, password)
      .then(() => {
        navigate(destination, { replace: true });
      })
      .catch((loginError: unknown) => {
        const message =
          loginError instanceof Error ? loginError.message : "Email or password is incorrect.";
        setError(message);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <p className="eyebrow">PH-Navigator V2</p>
        <h1 id="sign-in-title">Sign in</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const handleSignOut = () => {
    void signOut().finally(() => {
      navigate("/sign-in?next=%2Fdashboard", { replace: true });
    });
  };

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <Link className="brand" to="/dashboard" aria-label="PH-Navigator dashboard">
          PH-Nav
        </Link>
        <nav className="topnav" aria-label="Primary">
          <a aria-disabled="true">Catalogs</a>
        </nav>
        <div className="user-menu">
          <span>{session.user.display_name}</span>
          <button type="button" className="text-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 id="dashboard-title">Projects</h1>
          </div>
          <button type="button" disabled>
            New project
          </button>
        </div>
        <section className="empty-state" aria-label="Empty dashboard">
          <h2>No projects yet</h2>
          <p>
            Project creation lands in TB-02. This dashboard is ready for authenticated editor
            workflows.
          </p>
        </section>
      </section>
    </main>
  );
}

function ShellMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-live="polite">
        <p className="eyebrow">{title}</p>
        <h1>{message}</h1>
      </section>
    </main>
  );
}
