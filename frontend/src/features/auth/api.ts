import { fetchJson } from "../../shared/api/client";
import type { AuthSession } from "./types";

export async function fetchCurrentSession(signal?: AbortSignal): Promise<AuthSession> {
  return fetchJson<AuthSession>("/api/v1/auth/session", { signal });
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  return fetchJson<AuthSession>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signOut(): Promise<void> {
  await fetchJson<void>("/api/v1/auth/logout", { method: "POST" });
}
