import { useState } from "react";
import { errorMessage } from "../../lib/errors";

export type UseRowEditFormArgs<TRow> = {
  initialRow: TRow;
  onSubmit: (row: TRow) => Promise<void>;
  failureMessage: string;
  validate?: (row: TRow) => string | null;
  frozenReason?: string | null;
};

export function useRowEditForm<TRow>({
  initialRow,
  onSubmit,
  failureMessage,
  validate,
  frozenReason,
}: UseRowEditFormArgs<TRow>) {
  const [draft, setDraft] = useState(initialRow);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isFrozen = Boolean(frozenReason);

  const save = async () => {
    setError(null);
    if (frozenReason) {
      setError(frozenReason);
      return;
    }
    const validationError = validate?.(draft) ?? null;
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(draft);
    } catch (err) {
      setError(errorMessage(err, failureMessage));
      setIsSaving(false);
    }
  };

  return { draft, setDraft, error, isSaving, isFrozen, save, setError };
}
