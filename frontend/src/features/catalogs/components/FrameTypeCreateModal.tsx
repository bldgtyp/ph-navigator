import { type FormEvent, useMemo, useState } from "react";
import {
  btuHftFToWmK,
  parseLengthToMm,
  parseUValueToWm2K,
  useUnitPreference,
  type UnitFormatOptions,
  type UnitSystem,
} from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { FieldOption } from "../../../shared/ui/data-table";
import { FRAME_TYPES_SINGLE_SELECT_FIELDS } from "../frame-types/fieldDefs";
import { useCreateFrameTypeMutation } from "../hooks";
import type { CatalogFrameType, CatalogFrameTypeCreatePayload } from "../types";
import {
  colorToNull,
  editorSubmitLabel,
  parseOptionalNumber,
  parseOptionalUnitNumber,
  trimToNull,
} from "./form-helpers";
import { lengthUnitLabel, psiUnitLabel, uValueUnitLabel } from "./unit-labels";

type SelectFieldKey = (typeof FRAME_TYPES_SINGLE_SELECT_FIELDS)[number];

const SELECT_FIELD_LABELS: Record<SelectFieldKey, string> = {
  manufacturer: "Manufacturer",
  brand: "Brand",
  use: "Use",
  operation: "Operation",
  location: "Location",
  mull_type: "Mull type",
};

type FormState = {
  manufacturer: string;
  brand: string;
  use: string;
  operation: string;
  location: string;
  mull_type: string;
  prefix: string;
  suffix: string;
  material: string;
  width_mm: string;
  u_value_w_m2k: string;
  psi_g_w_mk: string;
  psi_install_w_mk: string;
  color: string;
  source: string;
  datasheet_url: string;
  comments: string;
};

const EMPTY_FORM: FormState = {
  manufacturer: "",
  brand: "",
  use: "",
  operation: "",
  location: "",
  mull_type: "",
  prefix: "",
  suffix: "",
  material: "",
  width_mm: "",
  u_value_w_m2k: "",
  psi_g_w_mk: "",
  psi_install_w_mk: "",
  color: "",
  source: "",
  datasheet_url: "",
  comments: "",
};

type ParsedFrameNumbers = Pick<
  CatalogFrameTypeCreatePayload,
  "width_mm" | "u_value_w_m2k" | "psi_g_w_mk" | "psi_install_w_mk"
>;

// Psi-values may legitimately be negative (favorable installs), so this
// parses the sign-permissive way the grid does — unlike
// `parseLinearPsiToWmK`, which rejects negatives.
function parseOptionalPsiToWmK(value: string, unitSystem: UnitSystem): number | null {
  const parsed = parseOptionalNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return parsed;
  return unitSystem === "IP" ? btuHftFToWmK(parsed) : parsed;
}

function parseFrameNumbers(
  form: FormState,
  unitOptions: UnitFormatOptions,
): ParsedFrameNumbers | null {
  const values: ParsedFrameNumbers = {
    width_mm: parseOptionalUnitNumber(form.width_mm, parseLengthToMm, unitOptions),
    u_value_w_m2k: parseOptionalUnitNumber(form.u_value_w_m2k, parseUValueToWm2K, unitOptions),
    psi_g_w_mk: parseOptionalPsiToWmK(form.psi_g_w_mk, unitOptions.unitSystem),
    psi_install_w_mk: parseOptionalPsiToWmK(form.psi_install_w_mk, unitOptions.unitSystem),
  };
  return Object.values(values).some((field) => field !== null && Number.isNaN(field))
    ? null
    : values;
}

// The backend stores the six categorization fields as option **labels**
// (D-2), so the form works in label space directly — no id mapping.
function toCreatePayload(
  form: FormState,
  numbers: ParsedFrameNumbers,
): CatalogFrameTypeCreatePayload {
  return {
    manufacturer: trimToNull(form.manufacturer),
    brand: trimToNull(form.brand),
    use: trimToNull(form.use),
    operation: trimToNull(form.operation),
    location: trimToNull(form.location),
    mull_type: trimToNull(form.mull_type),
    prefix: trimToNull(form.prefix),
    suffix: trimToNull(form.suffix),
    material: trimToNull(form.material),
    ...numbers,
    color: colorToNull(form.color),
    source: trimToNull(form.source),
    datasheet_url: trimToNull(form.datasheet_url),
    comments: trimToNull(form.comments),
  };
}

export function FrameTypeCreateModal({
  optionsByField,
  onClose,
  onCreated,
}: {
  optionsByField: Record<string, FieldOption[]>;
  onClose: () => void;
  onCreated: (created: CatalogFrameType) => void;
}) {
  const { unitSystem } = useUnitPreference();
  // Freeze labels/parsing while the modal is open so a global unit toggle does not rewrite input.
  const [formUnitSystem] = useState(unitSystem);
  const unitOptions = useMemo<UnitFormatOptions>(
    () => ({ unitSystem: formUnitSystem, showUnit: false, empty: "" }),
    [formUnitSystem],
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [parseError, setParseError] = useState<string | null>(null);
  const createMutation = useCreateFrameTypeMutation();
  const parsedNumbers = parseFrameNumbers(form, unitOptions);

  const canSubmit = parsedNumbers !== null && !createMutation.isPending;

  function updateForm(field: keyof FormState, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    setParseError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (parsedNumbers === null) {
      setParseError("Enter valid frame-type values.");
      return;
    }
    if (!canSubmit) return;
    createMutation.mutate(toCreatePayload(form, parsedNumbers), {
      onSuccess: (created) => onCreated(created),
    });
  }

  const errorText =
    parseError ??
    (createMutation.isError
      ? errorMessage(createMutation.error, "Could not create frame type.")
      : null);

  return (
    <ModalDialog title="New frame type" titleId="frame-type-create-title" onClose={onClose}>
      <form className="project-form" onSubmit={handleSubmit}>
        {FRAME_TYPES_SINGLE_SELECT_FIELDS.map((fieldKey) => (
          <AutocompleteSelect
            key={fieldKey}
            label={SELECT_FIELD_LABELS[fieldKey]}
            value={form[fieldKey]}
            options={[
              { value: "", label: "(none)" },
              ...(optionsByField[fieldKey] ?? []).map((option) => ({
                value: option.label,
                label: option.label,
                color: option.color,
              })),
            ]}
            onChange={(next) => updateForm(fieldKey, next)}
          />
        ))}
        <label>
          <span>Prefix</span>
          <input
            value={form.prefix}
            onChange={(event) => updateForm("prefix", event.target.value)}
          />
        </label>
        <label>
          <span>Suffix</span>
          <input
            value={form.suffix}
            onChange={(event) => updateForm("suffix", event.target.value)}
          />
        </label>
        <label>
          <span>Material</span>
          <input
            value={form.material}
            onChange={(event) => updateForm("material", event.target.value)}
          />
        </label>
        <label>
          <span>Width ({lengthUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.width_mm}
            onChange={(event) => updateForm("width_mm", event.target.value)}
          />
        </label>
        <label>
          <span>U-value ({uValueUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.u_value_w_m2k}
            onChange={(event) => updateForm("u_value_w_m2k", event.target.value)}
          />
        </label>
        <label>
          <span>Ψ-glazing ({psiUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.psi_g_w_mk}
            onChange={(event) => updateForm("psi_g_w_mk", event.target.value)}
          />
        </label>
        <label>
          <span>Ψ-install ({psiUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.psi_install_w_mk}
            onChange={(event) => updateForm("psi_install_w_mk", event.target.value)}
          />
        </label>
        <label>
          <span>Color</span>
          <input
            value={form.color}
            onChange={(event) => updateForm("color", event.target.value)}
            placeholder="#rrggbb"
          />
        </label>
        <label>
          <span>Source</span>
          <input
            value={form.source}
            onChange={(event) => updateForm("source", event.target.value)}
          />
        </label>
        <label>
          <span>Datasheet URL</span>
          <input
            type="url"
            value={form.datasheet_url}
            onChange={(event) => updateForm("datasheet_url", event.target.value)}
          />
        </label>
        <label>
          <span>Comments</span>
          <textarea
            rows={3}
            value={form.comments}
            onChange={(event) => updateForm("comments", event.target.value)}
          />
        </label>
        {errorText ? (
          <p className="form-error" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}>
            {editorSubmitLabel(false, createMutation.isPending, "Create frame type")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
