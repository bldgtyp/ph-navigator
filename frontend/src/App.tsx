import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import "./App.css";
import {
  ApiRequestError,
  checkBtNumber,
  createProject,
  fetchCurrentSession,
  fetchProject,
  listProjects,
  signIn,
  signOut,
  type AuthSession,
  type CertificationProgram,
  type CreateProjectPayload,
  type ProjectDetail,
  type ProjectSummary,
} from "./api";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: AuthSession }
  | { status: "auth-error" }
  | { status: "error"; message: string };

type AsyncState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

const PROJECT_TABS = ["status", "windows", "envelope", "equipment", "model"] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];

const TAB_LABELS: Record<ProjectTab, string> = {
  status: "Status",
  windows: "Windows",
  envelope: "Envelope",
  equipment: "Equipment",
  model: "Model",
};

const TAB_COPY: Record<ProjectTab, string> = {
  status: "Status tracker lands in TB-03.",
  windows: "Window type editing lands after the catalog tracer.",
  envelope: "Envelope assemblies land after the window catalog slices.",
  equipment: "Rooms and equipment tables start with the Rooms draft slice.",
  model: "HBJSON upload and the R3F viewer land after the asset backbone.",
};

const PROJECT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function projectTabPath(projectId: string, tab: ProjectTab): string {
  return `/projects/${projectId}/${tab}`;
}

function projectStatusPath(projectId: string): string {
  return projectTabPath(projectId, "status");
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route
          path="/dashboard"
          element={<RequireAuth>{(session) => <Dashboard session={session} />}</RequireAuth>}
        />
        <Route path="/projects/:projectId" element={<ProjectTabRedirect />} />
        <Route path="/projects/:projectId/:tab" element={<ProjectShell />} />
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
        if (isAuthFailure(error)) {
          setLoadState({ status: "auth-error" });
          return;
        }
        const message = error instanceof Error ? error.message : "Could not check session.";
        setLoadState({ status: "error", message });
      });
    return () => controller.abort();
  }, [location.key]);

  if (loadState.status === "loading") {
    return <ShellMessage title="Checking session" message="Loading dashboard..." />;
  }

  if (loadState.status === "auth-error") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }

  if (loadState.status === "error") {
    return <ShellMessage title="Session check failed" message={loadState.message} />;
  }

  return children(loadState.data);
}

function isAuthFailure(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  return (
    error.status === 401 &&
    ["not_authenticated", "session_expired", "session_invalidated", "invalid_session"].includes(
      error.errorCode ?? "",
    )
  );
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
  const [projectsState, setProjectsState] = useState<AsyncState<ProjectSummary[]>>({
    status: "loading",
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setProjectsState({ status: "loading" });
    void listProjects(controller.signal)
      .then((payload) => {
        setProjectsState({ status: "ready", data: payload.projects });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Could not load projects.";
        setProjectsState({ status: "error", message });
      });
    return () => controller.abort();
  }, []);

  const handleSignOut = () => {
    void signOut().finally(() => {
      navigate("/sign-in?next=%2Fdashboard", { replace: true });
    });
  };

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar>
        <>
          <span>{session.user.display_name}</span>
          <button type="button" className="text-button" onClick={handleSignOut}>
            Sign out
          </button>
        </>
      </WorkspaceTopbar>
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 id="dashboard-title">Projects</h1>
          </div>
          <button type="button" onClick={() => setIsCreateOpen(true)}>
            New project
          </button>
        </div>
        <ProjectList state={projectsState} />
      </section>
      {isCreateOpen ? (
        <NewProjectModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={(project) => {
            setIsCreateOpen(false);
            navigate(projectStatusPath(project.id));
          }}
        />
      ) : null}
    </main>
  );
}

function WorkspaceTopbar({ children }: { children: ReactNode }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/dashboard" aria-label="PH-Navigator dashboard">
        PH-Nav
      </Link>
      <nav className="topnav" aria-label="Primary">
        <a aria-disabled="true">Catalogs</a>
      </nav>
      <div className="user-menu">{children}</div>
    </header>
  );
}

function ProjectList({ state }: { state: AsyncState<ProjectSummary[]> }) {
  if (state.status === "loading") {
    return <section className="empty-state">Loading projects...</section>;
  }

  if (state.status === "error") {
    return (
      <section className="empty-state" role="alert">
        {state.message}
      </section>
    );
  }

  if (state.data.length === 0) {
    return (
      <section className="empty-state" aria-label="Empty dashboard">
        <h2>No projects yet</h2>
        <p>Create the first PH-Navigator V2 project shell from this dashboard.</p>
      </section>
    );
  }

  return (
    <section className="project-list" aria-label="Projects">
      <div className="project-list-heading">
        <span>BT #</span>
        <span>Project</span>
        <span>Client</span>
        <span>Last saved</span>
      </div>
      {state.data.map((project) => (
        <Link className="project-row" to={projectStatusPath(project.id)} key={project.id}>
          <span>{project.bt_number}</span>
          <strong>{project.name}</strong>
          <span>{project.client || "—"}</span>
          <span>{project.last_saved_at ? formatDate(project.last_saved_at) : "—"}</span>
        </Link>
      ))}
    </section>
  );
}

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: ProjectDetail) => void;
}) {
  const [name, setName] = useState("");
  const [btNumber, setBtNumber] = useState("");
  const [client, setClient] = useState("");
  const [certPrograms, setCertPrograms] = useState<CertificationProgram[]>([]);
  const [phiusNumber, setPhiusNumber] = useState("");
  const [availability, setAvailability] = useState<
    | { status: "idle" | "checking" | "available" | "taken"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle", message: "" });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedBtNumber = btNumber.trim();
  const includesPhius = certPrograms.includes("phius");

  useEffect(() => {
    if (!trimmedBtNumber) {
      setAvailability({ status: "idle", message: "" });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAvailability({ status: "checking", message: "Checking BT number..." });
      void checkBtNumber(trimmedBtNumber, controller.signal)
        .then((result) => {
          setAvailability(
            result.available
              ? { status: "available", message: "BT number available" }
              : {
                  status: "taken",
                  message: `BT number already used by ${result.conflict?.name ?? "another project"}`,
                },
          );
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          const message = error instanceof Error ? error.message : "Could not check BT number.";
          setAvailability({ status: "error", message });
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedBtNumber]);

  const toggleProgram = (program: CertificationProgram) => {
    setCertPrograms((current) =>
      current.includes(program)
        ? current.filter((value) => value !== program)
        : [...current, program],
    );
  };

  const canSubmit =
    name.trim().length > 0 &&
    trimmedBtNumber.length > 0 &&
    availability.status !== "checking" &&
    availability.status !== "taken" &&
    !isSubmitting;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    setIsSubmitting(true);

    const payload: CreateProjectPayload = {
      name: name.trim(),
      bt_number: trimmedBtNumber,
      client: client.trim() || null,
      cert_programs: certPrograms,
      phius_number: includesPhius ? phiusNumber.trim() || null : null,
      phius_dropbox_url: null,
    };

    void createProject(payload)
      .then(onCreated)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not create project.";
        setSubmitError(message);
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
      >
        <div className="modal-header">
          <h2 id="new-project-title">New project</h2>
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="project-form" onSubmit={handleSubmit}>
          <label>
            <span>Project name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            <span>BT number</span>
            <input
              value={btNumber}
              onChange={(event) => setBtNumber(event.target.value)}
              required
            />
          </label>
          {availability.message ? (
            <p className={`form-note form-note-${availability.status}`}>{availability.message}</p>
          ) : null}
          <label>
            <span>Client</span>
            <input value={client} onChange={(event) => setClient(event.target.value)} />
          </label>
          <fieldset>
            <legend>Certification programs</legend>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={certPrograms.includes("phi")}
                onChange={() => toggleProgram("phi")}
              />
              <span>PHI</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={certPrograms.includes("phius")}
                onChange={() => toggleProgram("phius")}
              />
              <span>Phius</span>
            </label>
          </fieldset>
          {includesPhius ? (
            <label>
              <span>Phius number</span>
              <input value={phiusNumber} onChange={(event) => setPhiusNumber(event.target.value)} />
            </label>
          ) : null}
          {submitError ? (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProjectTabRedirect() {
  const { projectId } = useParams();
  return <Navigate to={projectStatusPath(projectId ?? "")} replace />;
}

function ProjectShell() {
  const { projectId, tab } = useParams();
  const location = useLocation();
  const activeTab = PROJECT_TABS.includes(tab as ProjectTab) ? (tab as ProjectTab) : null;
  const [state, setState] = useState<AsyncState<ProjectDetail>>({ status: "loading" });

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetchProject(projectId, controller.signal)
      .then((project) => setState({ status: "ready", data: project }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Could not load project.";
        setState({ status: "error", message });
      });
    return () => controller.abort();
  }, [projectId]);

  if (!activeTab && projectId) {
    return <Navigate to={projectStatusPath(projectId)} replace />;
  }

  if (state.status === "loading") {
    return <ShellMessage title="Project" message="Loading project..." />;
  }

  if (state.status === "error") {
    return <ShellMessage title="Project unavailable" message={state.message} />;
  }

  const project = state.data;
  const isViewer = project.access_mode === "viewer";
  const returnPath = `${location.pathname}${location.search}${location.hash}`;

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar>
        {isViewer ? (
          <Link className="text-link" to={`/sign-in?next=${encodeURIComponent(returnPath)}`}>
            Sign in
          </Link>
        ) : (
          <span>Editor</span>
        )}
      </WorkspaceTopbar>
      <section className="project-page" aria-labelledby="project-title">
        {isViewer ? <div className="read-only-banner">Read-only public view</div> : null}
        <div className="project-header">
          <div>
            <p className="eyebrow">Project</p>
            <h1 id="project-title">{project.name}</h1>
            <p className="project-meta">
              {project.bt_number}
              {project.client ? ` · ${project.client}` : ""}
            </p>
          </div>
          <ProjectHeaderControls project={project} />
        </div>
        <nav className="tabbar" aria-label="Project tabs">
          {PROJECT_TABS.map((projectTab) => (
            <Link
              key={projectTab}
              className={projectTab === activeTab ? "active" : ""}
              to={projectTabPath(project.id, projectTab)}
            >
              {TAB_LABELS[projectTab]}
            </Link>
          ))}
        </nav>
        <ProjectTabContent tab={activeTab ?? "status"} project={project} />
      </section>
    </main>
  );
}

function ProjectHeaderControls({ project }: { project: ProjectDetail }) {
  if (project.access_mode === "viewer") {
    return <div className="shell-controls viewer-controls">Edit controls hidden</div>;
  }

  return (
    <div className="shell-controls">
      <button type="button" className="secondary-button" disabled>
        {project.active_version?.name ?? "No version"}
      </button>
      <span className="save-state">Clean</span>
      <button type="button" disabled>
        Save
      </button>
      <button type="button" className="secondary-button" disabled aria-label="Project settings">
        ...
      </button>
    </div>
  );
}

function ProjectTabContent({ tab, project }: { tab: ProjectTab; project: ProjectDetail }) {
  return (
    <section className="tab-panel" aria-labelledby={`${tab}-title`}>
      <h2 id={`${tab}-title`}>{TAB_LABELS[tab]}</h2>
      <p>{TAB_COPY[tab]}</p>
      <dl className="metadata-grid">
        <div>
          <dt>Active version</dt>
          <dd>{project.active_version?.name ?? "None"}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{project.access_mode === "editor" ? "Editor" : "Viewer"}</dd>
        </div>
      </dl>
    </section>
  );
}

function formatDate(value: string) {
  return PROJECT_DATE_FORMATTER.format(new Date(value));
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
