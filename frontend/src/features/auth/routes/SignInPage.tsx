import "../auth-page.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SignInForm } from "../components/SignInForm";

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const destination = next === "/" ? "/dashboard" : next;

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <p className="eyebrow">PH-Navigator V2</p>
        <h1 id="sign-in-title">Sign in</h1>
        <SignInForm onSuccess={() => navigate(destination, { replace: true })} />
      </section>
    </main>
  );
}
