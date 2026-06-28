import "../auth-page.css";
import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { type AccountCompletionMode, completeAccount } from "../api";

type AccountCompletionCopy = { title: string; eyebrow: string; cta: string };

const COPY: Record<AccountCompletionMode, AccountCompletionCopy> = {
  invite: { title: "Set your password", eyebrow: "Welcome to PH-Navigator", cta: "Set password" },
  reset: { title: "Choose a new password", eyebrow: "PH-Navigator", cta: "Update password" },
};

const MIN_PASSWORD_LENGTH = 8;

/** Reads the one-time token from the URL fragment and sets a new password. */
function tokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? "";
}

export function AccountCompletePage({ mode }: { mode: AccountCompletionMode }) {
  const location = useLocation();
  const token = tokenFromHash(location.hash);
  const copy = COPY[mode];

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>Link not valid</h1>
          <p>This link is missing its token. Ask an admin for a new link.</p>
        </section>
      </main>
    );
  }

  return <AccountCompletionForm key={`${mode}:${token}`} mode={mode} token={token} copy={copy} />;
}

function AccountCompletionForm({
  mode,
  token,
  copy,
}: {
  mode: AccountCompletionMode;
  token: string;
  copy: AccountCompletionCopy;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const completion = useMutation({
    mutationFn: () => completeAccount(mode, token, password),
  });

  const localError =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      : confirm.length > 0 && password !== confirm
        ? "Passwords do not match."
        : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (localError) return;
    completion.mutate();
  };

  if (completion.isSuccess) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>Password set</h1>
          <p>You can now sign in with your new password.</p>
          <Link to="/sign-in">Go to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="account-complete-title">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="account-complete-title">{copy.title}</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </label>
          {localError ? (
            <p className="form-error" role="alert">
              {localError}
            </p>
          ) : null}
          {completion.isError ? (
            <p className="form-error" role="alert">
              {errorMessage(completion.error, "This link is invalid or has expired.")}
            </p>
          ) : null}
          <button type="submit" disabled={completion.isPending || localError !== null}>
            {completion.isPending ? "Saving…" : copy.cta}
          </button>
        </form>
      </section>
    </main>
  );
}
