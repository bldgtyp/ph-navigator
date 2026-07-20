import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useUserAuditQuery } from "../hooks";
import type { AdminUser } from "../types";

export function UserAuditModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const auditQuery = useUserAuditQuery(user.id);
  const entries = auditQuery.data ?? [];

  return (
    <ModalDialog
      title={`Recent activity — ${user.email}`}
      titleId="user-audit-title"
      onClose={onClose}
      showHeaderClose
      dismissOnBackdrop
    >
      <div className="modal-body admin-audit">
        {auditQuery.isLoading ? <p>Loading…</p> : null}
        {auditQuery.isError ? (
          <p className="form-error" role="alert">
            {errorMessage(auditQuery.error, "Could not load activity.")}
          </p>
        ) : null}
        {!auditQuery.isLoading && !auditQuery.isError && entries.length === 0 ? (
          <p>No recorded activity for this user yet.</p>
        ) : null}
        {entries.length > 0 ? (
          <ul className="admin-audit-list">
            {entries.map((entry) => (
              <li key={entry.id} className="admin-audit-item">
                <span className="admin-audit-action">{entry.action}</span>
                <span className="admin-audit-meta">
                  {new Date(entry.created_at).toLocaleString()}
                  {entry.actor_email ? ` · by ${entry.actor_email}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </ModalDialog>
  );
}
