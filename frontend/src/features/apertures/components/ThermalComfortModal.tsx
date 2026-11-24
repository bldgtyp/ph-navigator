// Four-panel Phius window thermal-comfort modal mirroring `CondensationRiskModal`:
// 1. Verdict (+ editable aperture-level sill height & NFRC standard-size U)
// 2. Where (proportional aperture grid tinted by per-lite comfort state)
// 3. Numbers (per-lite table + inline exemption / perimeter-heat flags)
// 4. Assumptions (Td, 0.74 / 68 °F constants, ruleset, applet submittal disclaimer)

import { useEffect, useState } from "react";
import {
  formatLengthFromMm,
  formatUValueFromWm2K,
  parseLengthToMm,
  parseUValueToWm2K,
  useUnitPreference,
} from "../../../lib/units";
import { ModalDialog } from "../../../shared/ui";
import { lengthUnitLabel, uValueUnitLabel } from "../../catalogs/components/unit-labels";
import { thermalComfortChipPresentation } from "../comfort-chip";
import type {
  ApertureElementComfortResult,
  ApertureThermalComfortResult,
  ComfortExemptReason,
} from "../comfort-types";
import type { ApertureCommand, ApertureTypeEntry } from "../types";

export function ThermalComfortModal({
  open,
  aperture,
  result,
  canEdit,
  busy = false,
  onClose,
  onCommand,
}: {
  open: boolean;
  aperture: ApertureTypeEntry;
  result: ApertureThermalComfortResult | null;
  canEdit: boolean;
  busy?: boolean;
  onClose: () => void;
  onCommand: (command: ApertureCommand) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const [sillInput, setSillInput] = useState("");
  const [nfrcUInput, setNfrcUInput] = useState("");
  const [nfrcNoteInput, setNfrcNoteInput] = useState("");
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [exemptChecked, setExemptChecked] = useState(false);
  const [exemptReason, setExemptReason] = useState<ComfortExemptReason>("non_regularly_occupied");
  const [perimChecked, setPerimChecked] = useState(false);
  const [perimNote, setPerimNote] = useState("");
  const [flagError, setFlagError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSillInput(
      aperture.sill_height_mm !== null && aperture.sill_height_mm !== undefined
        ? formatLengthFromMm(aperture.sill_height_mm, { unitSystem, showUnit: false })
        : "",
    );
    setNfrcUInput(
      aperture.nfrc_whole_window_u_w_m2k !== null &&
        aperture.nfrc_whole_window_u_w_m2k !== undefined
        ? formatUValueFromWm2K(aperture.nfrc_whole_window_u_w_m2k, { unitSystem, showUnit: false })
        : "",
    );
    setNfrcNoteInput(aperture.nfrc_standard_size_note ?? "");
    setParamsError(null);
    setEditingElementId(null);
    setFlagError(null);
  }, [
    open,
    aperture.id,
    aperture.sill_height_mm,
    aperture.nfrc_whole_window_u_w_m2k,
    aperture.nfrc_standard_size_note,
    unitSystem,
  ]);

  if (!open) return null;

  const chip = thermalComfortChipPresentation(result, false, result === null);
  const elementById = new Map((result?.elements ?? []).map((el) => [el.element_id, el]));

  const handleSaveParams = () => {
    setParamsError(null);
    const trimmedSill = sillInput.trim();
    let sillMm: number | null = null;
    if (trimmedSill !== "") {
      const parsed = parseLengthToMm(trimmedSill, { unitSystem });
      if (!parsed.ok || Number.isNaN(parsed.valueSi) || parsed.valueSi < 0) {
        setParamsError("Enter a valid non-negative sill height.");
        return;
      }
      sillMm = parsed.valueSi;
    }

    const trimmedU = nfrcUInput.trim();
    let nfrcU: number | null = null;
    if (trimmedU !== "") {
      const parsedU = parseUValueToWm2K(trimmedU, { unitSystem });
      if (!parsedU.ok || Number.isNaN(parsedU.valueSi) || parsedU.valueSi <= 0) {
        setParamsError("Enter a positive NFRC standard-size U-value.");
        return;
      }
      nfrcU = parsedU.valueSi;
    }

    onCommand({
      kind: "setApertureComfortParams",
      aperture_type_id: aperture.id,
      sill_height_mm: sillMm,
      nfrc_whole_window_u_w_m2k: nfrcU,
      nfrc_standard_size_note: nfrcNoteInput.trim() || null,
    });
  };

  const openFlagEditor = (el: ApertureElementComfortResult) => {
    setEditingElementId(el.element_id);
    setExemptChecked(el.comfort_exempt);
    setExemptReason(el.comfort_exempt_reason ?? "non_regularly_occupied");
    setPerimChecked(el.perimeter_heat_within_3ft);
    setPerimNote(el.perimeter_heat_note ?? "");
    setFlagError(null);
  };

  const handleSaveFlags = () => {
    if (!editingElementId) return;
    if (perimChecked && perimNote.trim() === "") {
      setFlagError("Enter a note describing the perimeter heating source within 3 ft.");
      return;
    }
    setFlagError(null);
    onCommand({
      kind: "setElementComfortFlags",
      aperture_type_id: aperture.id,
      element_id: editingElementId,
      comfort_exempt: exemptChecked,
      comfort_exempt_reason: exemptChecked ? exemptReason : null,
      perimeter_heat_within_3ft: perimChecked,
      perimeter_heat_note: perimChecked ? perimNote.trim() : null,
    });
    setEditingElementId(null);
  };

  const tdC = result?.heating_990_db_c ?? null;
  const tdLabel =
    tdC === null
      ? "Not available"
      : unitSystem === "IP"
        ? `${((tdC * 9) / 5 + 32).toFixed(1)} °F (${tdC.toFixed(1)} °C)`
        : `${tdC.toFixed(1)} °C (${((tdC * 9) / 5 + 32).toFixed(1)} °F)`;

  return (
    <ModalDialog
      title={`Thermal comfort — ${aperture.name}`}
      titleId="thermal-comfort-modal-title"
      onClose={onClose}
      showHeaderClose
      dismissOnBackdrop
      resizable
      scrollBody
    >
      <div className="modal-form thermal-comfort-modal">
        {/* 1. Verdict + aperture-level inputs */}
        <section className="thermal-comfort-section" aria-label="Verdict">
          <div className="thermal-comfort-verdict">
            <span className={`chip chip--md chip--${chip.tone}`}>{chip.label}</span>
            {result?.governing_element_name ? (
              <span className="thermal-comfort-verdict__detail">
                Governing lite: <strong>{result.governing_element_name}</strong>
              </span>
            ) : null}
          </div>
          {result?.state === "blocked" ? (
            <p className="modal-lede">
              {result.blocked_reasons.includes("missing_sill_height")
                ? "Enter the sill height above finished floor below to derive each lite's head height and evaluate Phius U_max."
                : result.blocked_reasons.includes("missing_climate_source")
                  ? "Attach a project climate source with an ASHRAE 99% heating design temperature on the Climate tab."
                  : "Complete frame and glazing assignments (or enter an NFRC standard-size whole-window U) to evaluate every lite."}
            </p>
          ) : null}

          <div className="thermal-comfort-params">
            <label className="thermal-comfort-field">
              <span>Sill height above finished floor ({lengthUnitLabel(unitSystem)})</span>
              <input
                type="text"
                inputMode="decimal"
                value={sillInput}
                disabled={!canEdit || busy}
                placeholder="e.g. 900"
                onChange={(event) => setSillInput(event.target.value)}
              />
            </label>
            <label className="thermal-comfort-field">
              <span>NFRC standard-size whole-window U ({uValueUnitLabel(unitSystem)})</span>
              <input
                type="text"
                inputMode="decimal"
                value={nfrcUInput}
                disabled={!canEdit || busy}
                placeholder="Optional"
                onChange={(event) => setNfrcUInput(event.target.value)}
              />
            </label>
            <label className="thermal-comfort-field">
              <span>NFRC standard size note</span>
              <input
                type="text"
                value={nfrcNoteInput}
                disabled={!canEdit || busy}
                placeholder="e.g. 2.00 m x 2.00 m"
                onChange={(event) => setNfrcNoteInput(event.target.value)}
              />
            </label>
            {canEdit ? (
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={handleSaveParams}
              >
                Save parameters
              </button>
            ) : null}
          </div>
          {paramsError ? (
            <p className="form-error" role="alert">
              {paramsError}
            </p>
          ) : null}
        </section>

        {/* 2. Where — proportional grid tinted by state */}
        <section className="thermal-comfort-section" aria-label="Where">
          <h3>Where</h3>
          <div
            className="thermal-comfort-grid"
            style={{
              gridTemplateColumns: aperture.column_widths_mm.map((w) => `${w}fr`).join(" "),
              gridTemplateRows: aperture.row_heights_mm.map((h) => `${h}fr`).join(" "),
            }}
          >
            {aperture.elements.map((el) => {
              const comfort = elementById.get(el.id);
              const isGoverning = result?.governing_element_id === el.id;
              const stateClass =
                el.kind === "void"
                  ? "thermal-comfort-cell--void"
                  : `thermal-comfort-cell--${comfort?.state ?? "blocked"}`;
              return (
                <div
                  key={el.id}
                  className={`thermal-comfort-cell ${stateClass}${isGoverning ? " thermal-comfort-cell--governing" : ""}`}
                  style={{
                    gridRow: `${el.row_span[0] + 1} / ${el.row_span[1] + 2}`,
                    gridColumn: `${el.column_span[0] + 1} / ${el.column_span[1] + 2}`,
                  }}
                >
                  <strong>{el.name}</strong>
                  <span>{el.kind === "void" ? "Empty" : (comfort?.state ?? "blocked")}</span>
                  {isGoverning ? (
                    <span className="thermal-comfort-cell__gov">Governing</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Numbers — per-lite table */}
        <section className="thermal-comfort-section" aria-label="Numbers">
          <h3>Numbers</h3>
          <table className="thermal-comfort-table">
            <thead>
              <tr>
                <th>Lite</th>
                <th>Head height</th>
                <th>ΔT_max</th>
                <th>U_max</th>
                <th>Project U</th>
                <th>NFRC U</th>
                <th>Margin</th>
                <th>State</th>
                {canEdit ? <th>Flags</th> : null}
              </tr>
            </thead>
            <tbody>
              {(result?.elements ?? []).map((el) => (
                <tr key={el.element_id}>
                  <td>
                    {el.element_name}
                    {el.nfrc_route_missing_caveat ? (
                      <div className="thermal-comfort-note">NFRC standard-size U not supplied</div>
                    ) : null}
                    {el.perimeter_heat_within_3ft && el.perimeter_heat_note ? (
                      <div className="thermal-comfort-note">
                        Perimeter heat (comfort only, never condensation): {el.perimeter_heat_note}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {el.head_height_mm !== null
                      ? formatLengthFromMm(el.head_height_mm, { unitSystem, showUnit: true })
                      : "—"}
                  </td>
                  <td>{el.delta_t_max_f !== null ? `${el.delta_t_max_f.toFixed(1)} °F` : "—"}</td>
                  <td>
                    {el.u_max_w_m2k !== null
                      ? formatUValueFromWm2K(el.u_max_w_m2k, { unitSystem, showUnit: true })
                      : "—"}
                  </td>
                  <td>
                    {el.u_project_specific_w_m2k !== null
                      ? formatUValueFromWm2K(el.u_project_specific_w_m2k, {
                          unitSystem,
                          showUnit: true,
                        })
                      : "—"}
                  </td>
                  <td>
                    {el.u_nfrc_standard_w_m2k !== null
                      ? formatUValueFromWm2K(el.u_nfrc_standard_w_m2k, {
                          unitSystem,
                          showUnit: true,
                        })
                      : "—"}
                  </td>
                  <td>{el.margin !== null ? `${(el.margin * 100).toFixed(0)}%` : "—"}</td>
                  <td>{el.state}</td>
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => openFlagEditor(el)}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          {editingElementId ? (
            <div className="thermal-comfort-flag-editor">
              <label>
                <input
                  type="checkbox"
                  checked={exemptChecked}
                  onChange={(event) => setExemptChecked(event.target.checked)}
                />{" "}
                Comfort-exempt lite
              </label>
              {exemptChecked ? (
                <select
                  aria-label="Exemption reason"
                  value={exemptReason}
                  onChange={(event) => setExemptReason(event.target.value as ComfortExemptReason)}
                >
                  <option value="non_regularly_occupied">Non-regularly occupied (transient)</option>
                  <option value="ada_door">ADA door</option>
                </select>
              ) : null}
              <label>
                <input
                  type="checkbox"
                  checked={perimChecked}
                  onChange={(event) => setPerimChecked(event.target.checked)}
                />{" "}
                Active perimeter heating within 3 ft (satisfies comfort only — never condensation)
              </label>
              {perimChecked ? (
                <input
                  type="text"
                  aria-label="Perimeter heat evidence note"
                  placeholder="Describe active heating source within 3 ft"
                  value={perimNote}
                  onChange={(event) => setPerimNote(event.target.value)}
                />
              ) : null}
              {flagError ? (
                <p className="form-error" role="alert">
                  {flagError}
                </p>
              ) : null}
              <div className="thermal-comfort-flag-editor__actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingElementId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={handleSaveFlags}
                >
                  Save flags
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* 4. Assumptions */}
        <section className="thermal-comfort-section" aria-label="Assumptions">
          <h3>Assumptions</h3>
          <ul className="thermal-comfort-assumptions">
            <li>
              <strong>ASHRAE 99% heating design temp (Td):</strong> {tdLabel}
              {result?.climate_source_label ? ` — ${result.climate_source_label}` : ""}
              {result?.climate_source_basis ? ` (${result.climate_source_basis})` : ""}
            </li>
            <li>
              <strong>Criterion constants:</strong> 68 °F interior design temp, 0.74 hr·ft²·°F/Btu
              interior film resistance, ΔT_max clamped to 6.0–13.3 °F.
            </li>
            <li>
              <strong>Ruleset:</strong> {result?.ruleset ?? "phius-2024-r1"}
            </li>
          </ul>
          <p className="modal-lede">
            Pre-flight compliance screen only. The official Phius Window Comfort Applet remains the
            certification submittal artifact. Active perimeter heat satisfies thermal comfort only
            and never satisfies condensation risk.
          </p>
        </section>
      </div>
    </ModalDialog>
  );
}
