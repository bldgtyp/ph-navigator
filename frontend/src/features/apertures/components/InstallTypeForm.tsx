// Name + Ψ editor used by the Installs modal to create a type or edit one in
// place. One line inside the legend row it replaces: unit caption above the Ψ
// field, then name / Ψ / confirm / cancel. It stages — the modal writes the
// whole session on Save — so there is no busy or error state to carry here.
import { useState } from "react";
import { Check, X } from "lucide-react";
import { parseLinearPsiToWmK, useUnitPreference } from "../../../lib/units";
import { psiUnitLabel } from "../../catalogs/components/unit-labels";

/** `onSubmit`'s third argument reports whether the Ψ field was actually
 *  edited, so the caller can leave an untouched value alone rather than
 *  writing back its rounded display form. */
export function InstallTypeForm({
  testId,
  className,
  initialName,
  initialPsiText,
  submitTitle,
  usageNote,
  onCancel,
  onSubmit,
}: {
  testId: string;
  /** Extra class for the standalone create form, which draws its own card;
   *  the in-row editor inherits the legend row's box instead. */
  className?: string;
  initialName: string;
  initialPsiText: string;
  /** Tooltip / accessible name for the confirm control. */
  submitTitle: string;
  /** Project-wide usage line, shown only while editing an existing type — it
   *  counts edges across every aperture, not just the one on screen. */
  usageNote?: string;
  onCancel: () => void;
  onSubmit: (name: string, psiWmk: number | null, psiEdited: boolean) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const [name, setName] = useState(initialName);
  const [psiText, setPsiText] = useState(initialPsiText);
  // Empty Ψ is allowed (stored null → resolver degradation warning);
  // non-empty input parses through the unit-aware helper so IP-mode
  // entries convert to SI instead of being stored as-typed.
  const parsed = psiText.trim() === "" ? null : parseLinearPsiToWmK(psiText, { unitSystem });
  const psiError = parsed !== null && !parsed.ok ? parsed.message : null;
  return (
    <form
      className={className ? `installs-modal__create ${className}` : "installs-modal__create"}
      data-testid={testId}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === "" || psiError !== null) return;
        onSubmit(name.trim(), parsed?.ok ? parsed.valueSi : null, psiText !== initialPsiText);
      }}
      onKeyDown={(event) => {
        // Escape backs out of the form, not the whole modal: `ModalDialog`
        // listens on `document`, so stopping here keeps a reflex Escape from
        // discarding everything else the user did in this session.
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
    >
      {/* A prefilled edit hides the placeholder, so the unit is captioned over
          its field — this is a units-dual app and Ψ reads very differently in
          IP than in SI. */}
      {usageNote ? <span className="installs-modal__create-usage">{usageNote}</span> : null}
      <span className="installs-modal__create-unit">Ψ in {psiUnitLabel(unitSystem)}</span>
      <input
        type="text"
        value={name}
        placeholder="Type name"
        aria-label="Install type name"
        autoFocus
        onChange={(event) => setName(event.target.value)}
      />
      <input
        type="text"
        inputMode="decimal"
        value={psiText}
        placeholder={`Ψ ${psiUnitLabel(unitSystem)}`}
        aria-label={`Install type psi-value in ${psiUnitLabel(unitSystem)}`}
        onChange={(event) => setPsiText(event.target.value)}
      />
      <button
        type="submit"
        className="installs-modal__create-action installs-modal__create-action--confirm"
        disabled={name.trim() === "" || psiError !== null}
        title={submitTitle}
        aria-label={submitTitle}
      >
        <Check size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="installs-modal__create-action"
        onClick={onCancel}
        title="Cancel"
        aria-label="Cancel"
      >
        <X size={16} aria-hidden="true" />
      </button>
      {psiError ? (
        <p className="form-error installs-modal__create-error" role="alert">
          {psiError}
        </p>
      ) : null}
    </form>
  );
}
