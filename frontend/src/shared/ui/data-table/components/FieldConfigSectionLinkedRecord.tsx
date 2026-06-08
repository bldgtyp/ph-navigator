import { useId } from "react";

/**
 * One entry in the target-table dropdown. The modal consumer is
 * responsible for building this list from the document's
 * `TableContract` manifest, filtered to entries where
 * `link_targetable === true` and the table path is not the current
 * field's own table.
 */
export type LinkedRecordTargetTableOption = {
  /** JSON document path, e.g. `["equipment", "pumps"]`. */
  path: string[];
  /** User-facing label, e.g. "Pumps". */
  label: string;
};

export type FieldConfigSectionLinkedRecordProps = {
  /** Selected target path (joined for HTML form value identity). Null = none chosen. */
  targetPath: string[] | null;
  /** All allowable target tables. The modal pre-filters self / non-targetable. */
  targets: ReadonlyArray<LinkedRecordTargetTableOption>;
  onTargetPathChange: (path: string[] | null) => void;
  /** `null` = multi (no cap); `1` = single. PRD Q3 default is single. */
  maxLinks: number | null;
  onMaxLinksChange: (next: number | null) => void;
  /**
   * Disables both controls when the field is locked (e.g. an existing
   * linked_record field can change `max_links` but the modal disables
   * the target dropdown per PRD Q13).
   */
  targetLocked?: boolean;
  disabled?: boolean;
  className?: string;
};

function pathKey(path: ReadonlyArray<string>): string {
  return path.join("/");
}

/**
 * Type-specific config section for `linked_record`. Renders the
 * target-table dropdown (PRD §7) and a Single / Multiple cardinality
 * toggle (PRD Q3). Pure controlled component — the modal owns the
 * draft state and surfaces a "Save is disabled until target is set"
 * affordance.
 */
export function FieldConfigSectionLinkedRecord({
  targetPath,
  targets,
  onTargetPathChange,
  maxLinks,
  onMaxLinksChange,
  targetLocked = false,
  disabled = false,
  className = "data-table-field-config-modal-section",
}: FieldConfigSectionLinkedRecordProps) {
  const targetId = useId();
  const cardinalityGroupName = useId();
  const selectedKey = targetPath ? pathKey(targetPath) : "";

  return (
    <div className={className} data-testid="field-config-section-linked-record">
      <label className="data-table-add-field-label" htmlFor={targetId}>
        Target table
      </label>
      <select
        id={targetId}
        className="data-table-add-field-input"
        value={selectedKey}
        disabled={disabled || targetLocked}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (!next) {
            onTargetPathChange(null);
            return;
          }
          const match = targets.find((option) => pathKey(option.path) === next);
          onTargetPathChange(match ? [...match.path] : null);
        }}
      >
        <option value="">— select target table —</option>
        {targets.map((option) => (
          <option key={pathKey(option.path)} value={pathKey(option.path)}>
            {option.label}
          </option>
        ))}
      </select>

      <fieldset
        className="data-table-add-field-fieldset"
        disabled={disabled}
        aria-label="Cardinality"
      >
        <legend className="data-table-add-field-label">Cardinality</legend>
        <label>
          <input
            type="radio"
            name={cardinalityGroupName}
            checked={maxLinks === 1}
            onChange={() => onMaxLinksChange(1)}
          />
          <span> Single record</span>
        </label>
        <label>
          <input
            type="radio"
            name={cardinalityGroupName}
            checked={maxLinks === null}
            onChange={() => onMaxLinksChange(null)}
          />
          <span> Multiple records</span>
        </label>
      </fieldset>
    </div>
  );
}
