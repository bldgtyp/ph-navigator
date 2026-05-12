import { type FormEvent, useEffect, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useBtNumberAvailabilityQuery, useCreateProjectMutation } from "../hooks";
import { availabilityLabel } from "../lib";
import type { CertificationProgram, CreateProjectPayload, ProjectDetail } from "../types";

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

  const toggleProgram = (program: CertificationProgram) => {
    setCertPrograms((current) =>
      current.includes(program)
        ? current.filter((value) => value !== program)
        : [...current, program],
    );
  };

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
        <fieldset>
          <legend>Certification programs</legend>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={certPrograms.includes("phi")}
              onChange={() => toggleProgram("phi")}
            />
            <span>PHI</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={certPrograms.includes("phius")}
              onChange={() => toggleProgram("phius")}
            />
            <span>Phius</span>
          </label>
        </fieldset>
        {includesPhius ? (
          <label>
            <span>Phius number</span>
            <input value={phiusNumber} onChange={(event) => setPhiusNumber(event.target.value)} />
          </label>
        ) : null}
        {createProjectMutation.isError ? (
          <p className="form-error" role="alert">
            {errorMessage(createProjectMutation.error, "Could not create project.")}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}>
            {createProjectMutation.isPending ? "Creating..." : "Create project"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
