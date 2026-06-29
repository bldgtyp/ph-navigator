import { fetchJson } from "../../shared/api/client";
import type {
  AdminAuditEntry,
  AdminUser,
  InviteUserPayload,
  InviteUserResult,
  IssuedAccountLink,
  ReactivateUserResult,
} from "./types";

const BASE = "/api/v1/admin/users";

export async function fetchAdminUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  return fetchJson<AdminUser[]>(BASE, { signal });
}

export async function inviteUser(payload: InviteUserPayload): Promise<InviteUserResult> {
  return fetchJson<InviteUserResult>(`${BASE}/invite`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateResetLink(userId: string): Promise<IssuedAccountLink> {
  return fetchJson<IssuedAccountLink>(`${BASE}/${userId}/reset-link`, { method: "POST" });
}

export async function deactivateUser(userId: string): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${BASE}/${userId}/deactivate`, { method: "POST" });
}

export async function reactivateUser(userId: string): Promise<ReactivateUserResult> {
  return fetchJson<ReactivateUserResult>(`${BASE}/${userId}/reactivate`, { method: "POST" });
}

export async function setUserAdmin(userId: string, makeAdmin: boolean): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${BASE}/${userId}/admin`, {
    method: "PATCH",
    body: JSON.stringify({ make_admin: makeAdmin }),
  });
}

export async function updateUserName(userId: string, displayName: string): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${BASE}/${userId}/name`, {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function updateUserEmail(userId: string, email: string): Promise<AdminUser> {
  return fetchJson<AdminUser>(`${BASE}/${userId}/email`, {
    method: "PATCH",
    body: JSON.stringify({ email }),
  });
}

export async function fetchUserAudit(
  userId: string,
  signal?: AbortSignal,
): Promise<AdminAuditEntry[]> {
  return fetchJson<AdminAuditEntry[]>(`${BASE}/${userId}/audit`, { signal });
}
