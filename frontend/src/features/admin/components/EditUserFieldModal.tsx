import { type FormEvent, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useUpdateUserEmailMutation, useUpdateUserNameMutation } from "../hooks";
import type { AdminUser } from "../types";

type EditUserField = "name" | "email";

export function EditUserFieldModal({
  user,
  field,
  onClose,
}: {
  user: AdminUser;
  field: EditUserField;
  onClose: () => void;
}) {
  const isEmail = field === "email";
  const [value, setValue] = useState(isEmail ? user.email : user.display_name);
  const updateNameMutation = useUpdateUserNameMutation();
  const updateEmailMutation = useUpdateUserEmailMutation();
  const mutation = isEmail ? updateEmailMutation : updateNameMutation;
  const title = isEmail ? "Change Email" : "Change Name";
  const label = isEmail ? "Email" : "Name";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isEmail) {
      updateEmailMutation.mutate({ userId: user.id, email: value }, { onSuccess: onClose });
      return;
    }
    updateNameMutation.mutate({ userId: user.id, displayName: value }, { onSuccess: onClose });
  };

  return (
    <ModalDialog title={title} titleId="edit-user-field-title" onClose={onClose}>
      <form className="modal-body admin-form" onSubmit={handleSubmit}>
        <label>
          <span>{label}</span>
          <input
            type={isEmail ? "email" : "text"}
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
            autoFocus
          />
        </label>
        <DialogActions
          busy={mutation.isPending}
          error={
            mutation.isError
              ? errorMessage(mutation.error, `Could not update ${label.toLowerCase()}.`)
              : null
          }
          submitLabel={mutation.isPending ? "Saving..." : "OK"}
          onClose={onClose}
        />
      </form>
    </ModalDialog>
  );
}
