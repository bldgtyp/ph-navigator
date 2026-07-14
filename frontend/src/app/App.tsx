import "../App.css";
import { SessionExpiryRedirect } from "../features/auth/routes/SessionExpiryRedirect";
import { AppProviders } from "./providers";
import { AppRouter } from "./router";

export function App() {
  return (
    <AppProviders>
      <SessionExpiryRedirect />
      <AppRouter />
    </AppProviders>
  );
}
