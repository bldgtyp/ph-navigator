import { type FormEvent, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useInviteUserMutation } from "../hooks";
import type { AdminUserRolePreset, InviteUserResult } from "../types";

export function InviteUserModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (result: InviteUserResult) => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AdminUserRolePreset>("user");
  const inviteMutation = useInviteUserMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    inviteMutation.mutate({ email, display_name: displayName, role }, { onSuccess: onInvited });
  };

  return (
    <ModalDialog title="Invite user" titleId="invite-user-title" onClose={onClose}>
      <form className="modal-body admin-form" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AdminUserRolePreset)}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <DialogActions
          busy={inviteMutation.isPending}
          error={
            inviteMutation.isError
              ? errorMessage(inviteMutation.error, "Could not invite user.")
              : null
          }
          submitLabel={inviteMutation.isPending ? "Inviting…" : "Create invite"}
          onClose={onClose}
        />
      </form>
    </ModalDialog>
  );
}
