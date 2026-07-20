import { type FormEvent, useEffect, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useBtNumberAvailabilityQuery, useCreateProjectMutation } from "../hooks";
import { availabilityLabel } from "../lib";
import type { CertificationProgram, CreateProjectPayload, ProjectDetail } from "../types";
import { CertificationProgramFieldset } from "./CertificationProgramFieldset";

export function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: ProjectDetail) => void;
}) {
  const [name, setName] = useState("");
  const [btNumber, setBtNumber] = useState("");
  const [debouncedBtNumber, setDebouncedBtNumber] = useState("");
  const [client, setClient] = useState("");
  const [certPrograms, setCertPrograms] = useState<CertificationProgram[]>([]);
  const [phiusNumber, setPhiusNumber] = useState("");
  const createProjectMutation = useCreateProjectMutation();
  const trimmedBtNumber = btNumber.trim();
  const includesPhius = certPrograms.includes("phius");
  const availabilityQuery = useBtNumberAvailabilityQuery(
    debouncedBtNumber,
    debouncedBtNumber.length > 0,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedBtNumber(trimmedBtNumber);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [trimmedBtNumber]);

  const availabilityMessage = availabilityLabel(trimmedBtNumber, debouncedBtNumber, {
    isLoading: availabilityQuery.isLoading || availabilityQuery.isFetching,
    error: availabilityQuery.error,
    available: availabilityQuery.data?.available,
    conflictName: availabilityQuery.data?.conflict?.name,
  });
  const canSubmit =
    name.trim().length > 0 &&
    trimmedBtNumber.length > 0 &&
    !availabilityMessage.isChecking &&
    !availabilityMessage.isTaken &&
    !createProjectMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const payload: CreateProjectPayload = {
      name: name.trim(),
      bt_number: trimmedBtNumber,
      client: client.trim() || null,
      cert_programs: certPrograms,
      phius_number: includesPhius ? phiusNumber.trim() || null : null,
      phius_dropbox_url: null,
    };

    createProjectMutation.mutate(payload, { onSuccess: onCreated });
  };

  return (
    <ModalDialog title="New project" titleId="new-project-title" onClose={onClose}>
      <form className="project-form" onSubmit={handleSubmit}>
        <label>
          <span>Project name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          <span>BT number</span>
          <input value={btNumber} onChange={(event) => setBtNumber(event.target.value)} required />
        </label>
        {availabilityMessage.message ? (
          <p className={`form-note form-note-${availabilityMessage.status}`}>
            {availabilityMessage.message}
          </p>
        ) : null}
        <label>
          <span>Client</span>
          <input value={client} onChange={(event) => setClient(event.target.value)} />
        </label>
        <CertificationProgramFieldset value={certPrograms} onChange={setCertPrograms} />
        {includesPhius ? (
          <label>
            <span>Phius number</span>
            <input value={phiusNumber} onChange={(event) => setPhiusNumber(event.target.value)} />
          </label>
        ) : null}
        <DialogActions
          busy={createProjectMutation.isPending}
          error={
            createProjectMutation.isError
              ? errorMessage(createProjectMutation.error, "Could not create project.")
              : null
          }
          submitLabel={createProjectMutation.isPending ? "Creating…" : "Create project"}
          onClose={onClose}
          submitDisabled={!canSubmit}
        />
      </form>
    </ModalDialog>
  );
}
