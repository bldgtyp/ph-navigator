import { type FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { useSignInMutation } from "../hooks";

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const destination = next === "/" ? "/dashboard" : next;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signInMutation = useSignInMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    signInMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          navigate(destination, { replace: true });
        },
      },
    );
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
          {signInMutation.isError ? (
            <p className="form-error" role="alert">
              {errorMessage(signInMutation.error, "Email or password is incorrect.")}
            </p>
          ) : null}
          <button type="submit" disabled={signInMutation.isPending}>
            {signInMutation.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
