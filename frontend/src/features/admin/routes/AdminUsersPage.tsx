import "../admin.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { ShellMessage } from "../../../shared/ui/ShellMessage";
import { TopbarAccountMenu, WorkspaceTopbar } from "../../../shared/ui/WorkspaceTopbar";
import { useSignOutMutation } from "../../auth/hooks";
import type { AuthSession } from "../../auth/types";
import { AdminUsersTable } from "../components/AdminUsersTable";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { EditUserFieldModal } from "../components/EditUserFieldModal";
import { InviteUserModal } from "../components/InviteUserModal";
import { OneTimeLinkModal } from "../components/OneTimeLinkModal";
import { UserAuditModal } from "../components/UserAuditModal";
import {
  useAdminUsersQuery,
  useDeactivateUserMutation,
  useReactivateUserMutation,
  useResetLinkMutation,
  useSetUserAdminMutation,
} from "../hooks";
import { canManageUsers } from "../lib";
import type { AdminUser } from "../types";

type ConfirmKind = "deactivate" | "reactivate" | "grant" | "revoke";

type ActiveModal =
  | { kind: "invite" }
  | { kind: "link"; title: string; description: string; link: string }
  | { kind: "audit"; user: AdminUser }
  | { kind: "edit"; field: "name" | "email"; user: AdminUser }
  | { kind: "confirm"; action: ConfirmKind; user: AdminUser }
  | null;

const CONFIRM_COPY: Record<
  ConfirmKind,
  { title: string; message: (email: string) => string; confirmLabel: string }
> = {
  deactivate: {
    title: "Deactivate user",
    message: (email) => `Deactivate ${email}? Their sessions and tokens are revoked immediately.`,
    confirmLabel: "Deactivate",
  },
  reactivate: {
    title: "Reactivate user",
    message: (email) => `Reactivate ${email} and issue a fresh link so they can set a password?`,
    confirmLabel: "Reactivate",
  },
  grant: {
    title: "Grant Admin",
    message: (email) => `Grant ${email} the Admin role (manage users)?`,
    confirmLabel: "Grant Admin",
  },
  revoke: {
    title: "Revoke Admin",
    message: (email) => `Revoke ${email}'s Admin role?`,
    confirmLabel: "Revoke Admin",
  },
};

export function AdminUsersPage({ session }: { session: AuthSession }) {
  const navigate = useNavigate();
  const usersQuery = useAdminUsersQuery();
  const signOutMutation = useSignOutMutation();
  const resetLinkMutation = useResetLinkMutation();
  const deactivateMutation = useDeactivateUserMutation();
  const reactivateMutation = useReactivateUserMutation();
  const setAdminMutation = useSetUserAdminMutation();
  const [modal, setModal] = useState<ActiveModal>(null);

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSettled: () => navigate("/sign-in?next=%2Fadmin%2Fusers", { replace: true }),
    });
  };

  const showLink = (title: string, description: string, link: string) =>
    setModal({ kind: "link", title, description, link });

  const handleResetLink = (user: AdminUser) => {
    resetLinkMutation.mutate(user.id, {
      onSuccess: (issued) =>
        showLink("Reset link", `One-time password-reset link for ${user.email}.`, issued.link),
    });
  };

  const confirmActive = (): { busy: boolean; error: unknown; run: () => void } | null => {
    if (modal?.kind !== "confirm") return null;
    const { action, user } = modal;
    if (action === "deactivate") {
      return {
        busy: deactivateMutation.isPending,
        error: deactivateMutation.error,
        run: () => deactivateMutation.mutate(user.id, { onSuccess: () => setModal(null) }),
      };
    }
    if (action === "reactivate") {
      return {
        busy: reactivateMutation.isPending,
        error: reactivateMutation.error,
        run: () =>
          reactivateMutation.mutate(user.id, {
            onSuccess: (result) =>
              showLink("Reactivation link", `One-time link for ${user.email}.`, result.link.link),
          }),
      };
    }
    const makeAdmin = action === "grant";
    return {
      busy: setAdminMutation.isPending,
      error: setAdminMutation.error,
      run: () =>
        setAdminMutation.mutate(
          { userId: user.id, makeAdmin },
          { onSuccess: () => setModal(null) },
        ),
    };
  };

  const tableActions = {
    onChangeName: (user: AdminUser) => setModal({ kind: "edit", field: "name", user }),
    onChangeEmail: (user: AdminUser) => setModal({ kind: "edit", field: "email", user }),
    onResetLink: handleResetLink,
    onDeactivate: (user: AdminUser) => setModal({ kind: "confirm", action: "deactivate", user }),
    onReactivate: (user: AdminUser) => setModal({ kind: "confirm", action: "reactivate", user }),
    onToggleAdmin: (user: AdminUser) =>
      setModal({ kind: "confirm", action: user.role === "admin" ? "revoke" : "grant", user }),
    onViewAudit: (user: AdminUser) => setModal({ kind: "audit", user }),
  };

  const notAuthorized =
    !canManageUsers(session) || (usersQuery.isError && isForbidden(usersQuery.error));
  const confirm = confirmActive();

  return (
    <main className="workspace-shell">
      <WorkspaceTopbar
        breadcrumbs={[{ label: "Users", to: "/admin/users" }]}
        accountSlot={
          <TopbarAccountMenu label={session.user.display_name} onSignOut={handleSignOut} />
        }
      />
      <section className="admin-page" aria-label="User administration">
        {notAuthorized ? (
          <ShellMessage
            title="Not authorized"
            message="You do not have permission to manage users."
          />
        ) : (
          <>
            <div className="admin-page__heading">
              <h1>Users</h1>
              <button
                type="button"
                className="primary-button"
                onClick={() => setModal({ kind: "invite" })}
              >
                Invite user
              </button>
            </div>
            {usersQuery.isLoading ? <p>Loading users…</p> : null}
            {usersQuery.isError && !isForbidden(usersQuery.error) ? (
              <p className="form-error" role="alert">
                {errorMessage(usersQuery.error, "Could not load users.")}
              </p>
            ) : null}
            {usersQuery.data ? (
              <AdminUsersTable users={usersQuery.data} actions={tableActions} />
            ) : null}
          </>
        )}
      </section>

      {modal?.kind === "invite" ? (
        <InviteUserModal
          onClose={() => setModal(null)}
          onInvited={(result) =>
            showLink(
              "Invite link",
              `One-time invite link for ${result.user.email}.`,
              result.link.link,
            )
          }
        />
      ) : null}
      {modal?.kind === "link" ? (
        <OneTimeLinkModal
          title={modal.title}
          description={modal.description}
          link={modal.link}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.kind === "audit" ? (
        <UserAuditModal user={modal.user} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "edit" ? (
        <EditUserFieldModal user={modal.user} field={modal.field} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "confirm" && confirm ? (
        <ConfirmActionModal
          title={CONFIRM_COPY[modal.action].title}
          message={CONFIRM_COPY[modal.action].message(modal.user.email)}
          confirmLabel={CONFIRM_COPY[modal.action].confirmLabel}
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={confirm.run}
          onClose={() => setModal(null)}
        />
      ) : null}
    </main>
  );
}

function isForbidden(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 403
  );
}
