import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  formatRValueFromM2KPerW,
  formatTemperatureFromC,
  formatVaporMu,
  formatVaporSd,
  useUnitPreference,
  type UnitSystem,
} from "../../../lib/units";
import { formatNumberWithUnit } from "../../../lib/units/format";
import {
  changeModel,
  climateSourceLabel,
  materialsForAssembly,
  modelLabel,
  parseSettingsDraft,
  provenanceLabel,
  settingsDraft,
  type SettingsDraft,
} from "../condensation-assumption-data";
import { orderedCondensationMonths } from "../condensation-chart-data";
import { formatCondensationPercent } from "../condensation-format";
import type { AssemblyCondensationResponse, CondensationSettings } from "../condensation-types";
import type { Assembly, ProjectMaterial } from "../types";

export function CondensationAssumptionsPanel({
  projectId,
  assembly,
  materials,
  result,
  canEdit,
  busy,
  commandError,
  onApply,
}: {
  projectId: string;
  assembly: Assembly;
  materials: ProjectMaterial[];
  result: AssemblyCondensationResponse;
  canEdit: boolean;
  busy: boolean;
  commandError: string | null;
  onApply: (settings: CondensationSettings) => Promise<boolean>;
}) {
  const { unitSystem } = useUnitPreference();
  const [draft, setDraft] = useState<SettingsDraft>(() =>
    settingsDraft(result.settings, unitSystem),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(settingsDraft(result.settings, unitSystem));
    setSaved(false);
    setLocalError(null);
  }, [result.input_hash, result.settings, unitSystem]);

  const parsed = parseSettingsDraft(draft, unitSystem);
  const dirty = parsed.settings
    ? JSON.stringify(parsed.settings) !== JSON.stringify(result.settings)
    : true;
  const assemblyMaterials = useMemo(
    () => materialsForAssembly(assembly, materials),
    [assembly, materials],
  );

  async function save(): Promise<void> {
    setSaved(false);
    if (!parsed.settings) {
      setLocalError(parsed.error);
      return;
    }
    setLocalError(null);
    const applied = await onApply(parsed.settings);
    if (applied) setSaved(true);
  }

  return (
    <div className="condensation-assumptions">
      <section className="condensation-assumptions__section">
        <header className="condensation-tier-heading">
          <div>
            <h3>Exterior climate</h3>
            <p>
              {climateSourceLabel(result)} · monthly exterior air temperature and derived relative
              humidity.
            </p>
          </div>
          <NavLink className="secondary-button" to={`/projects/${projectId}/climate`}>
            Open Climate
          </NavLink>
        </header>
        <div className="condensation-climate-grid" role="list" aria-label="Exterior climate months">
          {orderedCondensationMonths(result).map((month) => (
            <div
              key={month.month}
              className="condensation-climate-grid__month"
              role="listitem"
              aria-label={`${month.month_name}: exterior air ${formatTemperatureFromC(
                month.exterior_air_temp_c,
                { unitSystem },
              )}; relative humidity ${formatCondensationPercent(month.exterior_rh)}`}
            >
              <strong>{month.month_name.slice(0, 3)}</strong>
              <span>{formatTemperatureFromC(month.exterior_air_temp_c, { unitSystem })}</span>
              <span>{formatCondensationPercent(month.exterior_rh)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="condensation-assumptions__section">
        <header className="condensation-tier-heading">
          <div>
            <h3>Interior climate and moisture limit</h3>
            <p>Versioned assumptions; changing them recalculates every assembly in this draft.</p>
          </div>
        </header>
        {canEdit ? (
          <form
            className="condensation-settings-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="condensation-settings-form__wide">
              <span>Interior climate model</span>
              <select
                aria-label="Interior climate model"
                value={draft.model}
                onChange={(event) => {
                  const model = event.currentTarget.value as SettingsDraft["model"];
                  setDraft((current) => changeModel(current, model, unitSystem));
                }}
              >
                <option value="iso13788_continental">ISO 13788 continental / tropical</option>
                <option value="iso13788_humidity_class">ISO 13788 humidity class</option>
                <option value="fixed_setpoint">Fixed temperature and RH</option>
              </select>
            </label>

            {draft.model === "iso13788_continental" ? (
              <label className="condensation-settings-form__wide">
                <span>Occupancy class</span>
                <select
                  aria-label="Occupancy class"
                  value={draft.occupancyClass}
                  onChange={(event) => {
                    const occupancyClass = event.currentTarget
                      .value as SettingsDraft["occupancyClass"];
                    setDraft((current) => ({
                      ...current,
                      occupancyClass,
                    }));
                  }}
                >
                  <option value="low">Low / PHI cold-climate recommendation (driest)</option>
                  <option value="normal">Normal (default)</option>
                  <option value="high">High</option>
                </select>
              </label>
            ) : null}

            {draft.model === "iso13788_humidity_class" ? (
              <label>
                <span>Humidity class</span>
                <select
                  aria-label="Humidity class"
                  value={draft.humidityClass}
                  onChange={(event) => {
                    const humidityClass = event.currentTarget.value;
                    setDraft((current) => ({
                      ...current,
                      humidityClass,
                    }));
                  }}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      Class {value}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {draft.model !== "iso13788_continental" ? (
              <label>
                <span>Interior temperature ({unitSystem === "IP" ? "°F" : "°C"})</span>
                <input
                  aria-label="Interior setpoint temperature"
                  type="number"
                  step="0.1"
                  value={draft.setpointTemperature}
                  onChange={(event) => {
                    const setpointTemperature = event.currentTarget.value;
                    setDraft((current) => ({
                      ...current,
                      setpointTemperature,
                    }));
                  }}
                />
              </label>
            ) : null}

            {draft.model === "fixed_setpoint" ? (
              <label>
                <span>Interior relative humidity (%)</span>
                <input
                  aria-label="Interior setpoint relative humidity"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={draft.setpointRhPercent}
                  onChange={(event) => {
                    const setpointRhPercent = event.currentTarget.value;
                    setDraft((current) => ({
                      ...current,
                      setpointRhPercent,
                    }));
                  }}
                />
              </label>
            ) : null}

            <label>
              <span>Accumulated moisture limit (g/m²)</span>
              <input
                aria-label="Accumulated moisture limit"
                type="number"
                min="0.1"
                step="0.1"
                value={draft.maLimit}
                onChange={(event) => {
                  const maLimit = event.currentTarget.value;
                  setDraft((current) => ({ ...current, maLimit }));
                }}
              />
            </label>

            <div className="condensation-settings-guidance condensation-settings-form__wide">
              <strong>Reference values</strong>
              <span>200 g/m² · ISO 13788 watertight-surface run-off screen</span>
              <span>1,000 g/m² · DIN 4108-3 general reference</span>
              <span>30–250 g/m² · BS 5250 surface-angle range</span>
            </div>

            {localError || commandError ? (
              <p className="form-error condensation-settings-form__wide" role="alert">
                {localError ?? commandError}
              </p>
            ) : null}
            {saved ? (
              <p className="form-note condensation-settings-form__wide" role="status">
                Assumptions saved to the draft; the result is recalculating.
              </p>
            ) : null}
            <div className="condensation-settings-form__actions condensation-settings-form__wide">
              <button
                type="submit"
                className="primary-button"
                disabled={busy || !dirty || parsed.settings === null}
              >
                {busy ? "Saving…" : "Apply assumptions"}
              </button>
            </div>
          </form>
        ) : (
          <ReadOnlySettings settings={result.settings} unitSystem={unitSystem} />
        )}
      </section>

      <section className="condensation-assumptions__section">
        <header className="condensation-tier-heading">
          <div>
            <h3>Derived method facts</h3>
            <p>Read-only values used for this exact result.</p>
          </div>
        </header>
        <dl className="condensation-derived-facts">
          <Fact label="Start month" value={result.start_month_name ?? "—"} />
          <Fact
            label="Interior surface resistance"
            value={formatRValueFromM2KPerW(result.rsi_m2k_w, { unitSystem })}
          />
          <Fact
            label="Exterior surface resistance"
            value={formatRValueFromM2KPerW(result.rse_m2k_w, { unitSystem })}
          />
          <Fact
            label="Roof temperature correction"
            value={
              result.roof_temperature_offset_k === 0
                ? "Not applied"
                : `${result.roof_temperature_offset_k.toFixed(1)} K applied`
            }
          />
          <Fact
            label="Surface-film standard"
            value={result.thermal_standard === "iso_6946" ? "ISO 6946" : "ASHRAE"}
          />
        </dl>
        {result.verdict === "d4" ? (
          <p className="condensation-derived-note">
            No annual cycle closed. The displayed start month is the canonical month after the
            annual accumulated-moisture minimum.
          </p>
        ) : null}
        {assembly.exterior_condition === "ventilated" ? (
          <p className="condensation-derived-note">
            Ventilated boundary convention: the modelled stack must stop inboard of the
            well-ventilated cavity; PHN does not truncate outboard layers automatically.
          </p>
        ) : null}
        {result.diagnostics.some(
          (item) => item.code === "iso_6946_exterior_rule_with_non_iso_films",
        ) ? (
          <p className="condensation-derived-note">
            The ventilated-cavity `Rse = Rsi` rule is ISO 6946-based even though the selected film
            table uses another standard.
          </p>
        ) : null}
      </section>

      <section className="condensation-assumptions__section">
        <header className="condensation-tier-heading">
          <div>
            <h3>Material vapour provenance</h3>
            <p>Values on every material assigned to this assembly.</p>
          </div>
        </header>
        <div className="condensation-provenance">
          {assemblyMaterials.map((material) => (
            <article key={material.id}>
              <strong>{material.name}</strong>
              <span>
                {formatVaporMu(material.vapor_diffusion_resistance_mu, { unitSystem })} ·{" "}
                {formatVaporSd(material.vapor_sd_equivalent_m, { unitSystem })}
              </span>
              <span>{provenanceLabel(material)}</span>
              <span>{material.source ?? "No source recorded"}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReadOnlySettings({
  settings,
  unitSystem,
}: {
  settings: CondensationSettings;
  unitSystem: UnitSystem;
}) {
  return (
    <dl className="condensation-derived-facts">
      <Fact label="Interior climate model" value={modelLabel(settings.interior_climate_model)} />
      {settings.interior_climate_model === "iso13788_continental" ? (
        <Fact label="Occupancy class" value={settings.occupancy_class} />
      ) : null}
      {settings.interior_climate_model === "iso13788_humidity_class" ? (
        <Fact label="Humidity class" value={String(settings.humidity_class)} />
      ) : null}
      {settings.setpoint_temp_c !== null ? (
        <Fact
          label="Interior temperature"
          value={formatTemperatureFromC(settings.setpoint_temp_c, { unitSystem })}
        />
      ) : null}
      {settings.setpoint_rh !== null ? (
        <Fact
          label="Interior relative humidity"
          value={formatCondensationPercent(settings.setpoint_rh)}
        />
      ) : null}
      <Fact
        label="Accumulated moisture limit"
        value={formatNumberWithUnit(settings.ma_limit_g_m2, "g/m²", {
          unitSystem: "SI",
          fractionDigits: 1,
        })}
      />
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
