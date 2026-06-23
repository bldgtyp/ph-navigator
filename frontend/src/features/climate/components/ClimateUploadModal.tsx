import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { uploadAsset } from "../../assets/hooks";
import { useAttachWeatherFromUploadMutation } from "../hooks";
import type { ProjectClimateSource } from "../types";
import "../climate-picker.css";

// The "Upload Climate Data" modal: manual upload of the EPW (required) plus its
// optional STAT / DDY companions. Each chosen file is stored as an asset, then
// the bundle is attached as the single weather source (the STAT supplies the
// design-condition metrics; the DDY is stored by reference only).
export function ClimateUploadModal({
  projectId,
  onClose,
  onAttached,
}: {
  projectId: string;
  onClose: () => void;
  onAttached?: (source: ProjectClimateSource) => void;
}) {
  const [epwFile, setEpwFile] = useState<File | null>(null);
  const [statFile, setStatFile] = useState<File | null>(null);
  const [ddyFile, setDdyFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const attach = useAttachWeatherFromUploadMutation(projectId);
  const busy = isUploading || attach.isPending;

  const submit = async () => {
    if (!epwFile) return;
    setError(null);
    setIsUploading(true);
    try {
      const epw_asset_id = await uploadAsset(projectId, "epw", epwFile);
      const stat_asset_id = statFile ? await uploadAsset(projectId, "stat", statFile) : null;
      const ddy_asset_id = ddyFile ? await uploadAsset(projectId, "ddy", ddyFile) : null;
      const source = await attach.mutateAsync({ epw_asset_id, stat_asset_id, ddy_asset_id });
      onAttached?.(source);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not upload the weather files."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalDialog
      id="climate-upload"
      title="Upload climate data"
      titleId="climate-upload-title"
      onClose={onClose}
    >
      <div className="climate-picker-content">
        <p className="form-note">
          Upload an EPW weather file and, optionally, its STAT (design conditions) and DDY (design
          days) companions. The STAT supplies the design-condition metrics.
        </p>
        <div className="climate-upload-slots">
          <UploadSlot
            label="EPW weather file"
            required
            accept=".epw,text/plain,application/octet-stream"
            file={epwFile}
            onPick={setEpwFile}
          />
          <UploadSlot
            label="STAT design conditions"
            accept=".stat,text/plain,application/octet-stream"
            file={statFile}
            onPick={setStatFile}
          />
          <UploadSlot
            label="DDY design days"
            accept=".ddy,text/plain,application/octet-stream"
            file={ddyFile}
            onPick={setDdyFile}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={() => void submit()} disabled={!epwFile || busy}>
            {busy ? "Uploading…" : "Upload & attach"}
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </ModalDialog>
  );
}

function UploadSlot({
  label,
  accept,
  file,
  onPick,
  required = false,
}: {
  label: string;
  accept: string;
  file: File | null;
  onPick: (file: File | null) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="climate-upload-slot">
      <span className="climate-upload-slot-label">
        {required ? `${label} *` : `${label} (optional)`}
      </span>
      <input
        ref={inputRef}
        className="attachment-file-input"
        type="file"
        accept={accept}
        aria-label={label}
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
      <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
        <Upload size={16} aria-hidden="true" />
        {file ? "Change file" : "Choose file"}
      </button>
      {file ? <span className="form-note">{file.name}</span> : null}
    </div>
  );
}
