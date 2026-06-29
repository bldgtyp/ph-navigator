import {
  AtSign,
  History,
  KeyRound,
  Pencil,
  Power,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { AppMenu, AppMenuItem } from "../../../shared/ui/AppMenu";
import { roleLabel, statusLabel } from "../lib";
import type { AdminUser } from "../types";

export type AdminUserActions = {
  onChangeName: (user: AdminUser) => void;
  onChangeEmail: (user: AdminUser) => void;
  onResetLink: (user: AdminUser) => void;
  onDeactivate: (user: AdminUser) => void;
  onReactivate: (user: AdminUser) => void;
  onToggleAdmin: (user: AdminUser) => void;
  onViewAudit: (user: AdminUser) => void;
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export function AdminUsersTable({
  users,
  actions,
}: {
  users: AdminUser[];
  actions: AdminUserActions;
}) {
  return (
    <table className="admin-users-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Role</th>
          <th>Created</th>
          <th>Last action</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.display_name}</td>
            <td>{user.email}</td>
            <td>
              <span className={`admin-chip admin-chip--${user.status}`}>
                {statusLabel(user.status)}
              </span>
            </td>
            <td>
              <span className={`admin-chip admin-chip--role-${user.role}`}>
                {roleLabel(user.role)}
              </span>
            </td>
            <td>{formatDate(user.created_at)}</td>
            <td>{formatDate(user.last_action_at)}</td>
            <td className="admin-users-table__actions">
              <AppMenu label={`Actions for ${user.email}`}>
                <AppMenuItem icon={Pencil} onClick={() => actions.onChangeName(user)}>
                  Change Name
                </AppMenuItem>
                <AppMenuItem icon={AtSign} onClick={() => actions.onChangeEmail(user)}>
                  Change Email
                </AppMenuItem>
                {user.status !== "inactive" ? (
                  <AppMenuItem icon={KeyRound} onClick={() => actions.onResetLink(user)}>
                    Generate reset link
                  </AppMenuItem>
                ) : null}
                {user.role === "admin" ? (
                  <AppMenuItem icon={ShieldOff} onClick={() => actions.onToggleAdmin(user)}>
                    Revoke Admin
                  </AppMenuItem>
                ) : (
                  <AppMenuItem icon={ShieldCheck} onClick={() => actions.onToggleAdmin(user)}>
                    Grant Admin
                  </AppMenuItem>
                )}
                {user.status === "inactive" ? (
                  <AppMenuItem icon={RotateCcw} onClick={() => actions.onReactivate(user)}>
                    Reactivate
                  </AppMenuItem>
                ) : (
                  <AppMenuItem icon={Power} danger onClick={() => actions.onDeactivate(user)}>
                    Deactivate
                  </AppMenuItem>
                )}
                <AppMenuItem icon={History} onClick={() => actions.onViewAudit(user)}>
                  View activity
                </AppMenuItem>
              </AppMenu>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
