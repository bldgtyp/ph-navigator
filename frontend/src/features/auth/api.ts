import { fetchJson } from "../../shared/api/client";
import type { UnitSystem } from "../../lib/units/types";
import type { AuthSession } from "./types";
import { clearSessionAuthentication, markSessionAuthenticated } from "./session-lifecycle";

export async function fetchCurrentSession(signal?: AbortSignal): Promise<AuthSession> {
  const session = await fetchJson<AuthSession>("/api/v1/auth/session", { signal });
  markSessionAuthenticated();
  return session;
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const session = await fetchJson<AuthSession>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  markSessionAuthenticated();
  return session;
}

export async function signOut(): Promise<void> {
  try {
    await fetchJson<void>("/api/v1/auth/logout", { method: "POST" });
  } finally {
    clearSessionAuthentication();
  }
}

export async function updateUnitsPreference(unitsPreference: UnitSystem): Promise<AuthSession> {
  return fetchJson<AuthSession>("/api/v1/auth/preferences", {
    method: "PATCH",
    body: JSON.stringify({ units_preference: unitsPreference }),
  });
}

export type AccountCompletionMode = "invite" | "reset";

const COMPLETION_PATHS: Record<AccountCompletionMode, string> = {
  invite: "/api/v1/auth/invite/complete",
  reset: "/api/v1/auth/reset/complete",
};

/** Set a password from an invite/reset link. The raw token comes from the URL fragment. */
export async function completeAccount(
  mode: AccountCompletionMode,
  token: string,
  password: string,
): Promise<void> {
  await fetchJson<void>(COMPLETION_PATHS[mode], {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
