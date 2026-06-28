import type { AuthSession } from "../auth/types";
import type { AdminUserRolePreset, AdminUserStatus } from "./types";

// Must match ADMIN_USERS_MANAGE in backend/features/access/capabilities.py.
export const ADMIN_USERS_MANAGE = "admin.users.manage";

export const ADMIN_USERS_PATH = "/admin/users";

/** Whether the signed-in user may manage other users (gates the admin nav/page). */
export function canManageUsers(session: AuthSession): boolean {
  return (session.capabilities ?? []).includes(ADMIN_USERS_MANAGE);
}

const STATUS_LABELS: Record<AdminUserStatus, string> = {
  active: "Active",
  invited: "Invited",
  inactive: "Inactive",
};

const ROLE_LABELS: Record<AdminUserRolePreset, string> = {
  user: "User",
  admin: "Admin",
};

export function statusLabel(status: AdminUserStatus): string {
  return STATUS_LABELS[status];
}

export function roleLabel(role: AdminUserRolePreset): string {
  return ROLE_LABELS[role];
}
