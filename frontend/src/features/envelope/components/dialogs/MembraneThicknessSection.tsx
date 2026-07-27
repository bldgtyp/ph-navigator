/**
 * A membrane layer's thickness, edited from the Segment Properties dialog.
 *
 * The canvas no longer offers this number — a membrane's drawn band is not its
 * thickness, so showing it there contradicted the drawing beside it.
 *
 * Presentational, with the draft owned by the dialog, matching
 * `SteelStudParameters` alongside it. The value is written on Apply rather than
 * on blur because `applyCommand` closes the dialog after every successful
 * command: committing on blur would make the dialog vanish the moment the user
 * tabbed out of this field.
 */
export function MembraneThicknessSection({
  unitLabel,
  draft,
  error,
  onDraftChange,
}: {
  unitLabel: string;
  draft: string;
  error: string | null;
  onDraftChange: (value: string) => void;
}) {
  return (
    <section
      id="envelope-segment-thickness-section"
      className="segment-dialog-section"
      role="group"
      aria-labelledby="envelope-segment-thickness-heading"
    >
      <h3 id="envelope-segment-thickness-heading" className="segment-dialog-section-heading">
        Thickness ({unitLabel})
      </h3>
      <div className="segment-geometry-grid">
        <input
          id="envelope-segment-thickness-input"
          aria-label={`Thickness (${unitLabel})`}
          aria-invalid={error ? "true" : "false"}
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
        />
      </div>
    </section>
  );
}
