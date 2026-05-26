import { type FormEvent, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { useSignInMutation } from "../hooks";

export type SignInFormProps = {
  onSuccess: () => void;
};

export function SignInForm({ onSuccess }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signInMutation = useSignInMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    signInMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          onSuccess();
        },
      },
    );
  };

  return (
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
  );
}
