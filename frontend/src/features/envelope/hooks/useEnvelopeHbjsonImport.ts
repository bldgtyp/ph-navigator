import { useRef, useState, type ChangeEvent } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { useEnvelopeHbjsonImportPreviewMutation } from "../hooks";
import type { ImportConstructionsPreview } from "../types";

export type EnvelopeImportPlan = {
  preview: ImportConstructionsPreview;
  // The parsed file object, carried back on the apply command (PRD §6 step 2).
  file: Record<string, unknown>;
};

/**
 * Drives the "Upload constructions HBJSON" flow: pick a file, preview it
 * (dry run), and hold the resulting plan until the user confirms or cancels.
 * Applying the plan is the caller's job (it reuses the envelope-command rail).
 */
export function useEnvelopeHbjsonImport(projectId: string, versionId: string | null) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewMutation = useEnvelopeHbjsonImportPreviewMutation(projectId, versionId);
  const [plan, setPlan] = useState<EnvelopeImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openFilePicker(): void {
    setError(null);
    inputRef.current?.click();
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again re-fires the change event.
    event.target.value = "";
    if (!file) return;
    setError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(await readFileText(file)) as Record<string, unknown>;
    } catch {
      setError("The selected file is not valid JSON.");
      return;
    }

    try {
      const preview = await previewMutation.mutateAsync(file);
      setPlan({ preview, file: parsed });
    } catch (previewError) {
      setError(errorMessage(previewError, "Could not read the constructions file."));
    }
  }

  function reset(): void {
    setPlan(null);
    setError(null);
  }

  return {
    inputRef,
    openFilePicker,
    onFileChange,
    plan,
    error,
    previewing: previewMutation.isPending,
    reset,
  };
}

// `Blob.text()` is unavailable in some test/runtime environments; FileReader is
// the portable read that works everywhere a real file input does.
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsText(file);
  });
}
