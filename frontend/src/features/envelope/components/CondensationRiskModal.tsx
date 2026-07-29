import { useMemo, useState, type KeyboardEvent } from "react";
import { NavLink } from "react-router-dom";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { condensationChipPresentation, isMissingVapourIssue } from "../condensation-chip";
import type { ProjectMaterialEditorInitialFocus } from "./ProjectMaterialEditor";
import type { AssemblyCondensationResponse, CondensationIssue } from "../condensation-types";
import type { Assembly, ProjectMaterial } from "../types";
import { CondensationVerdictPanel } from "./CondensationVerdictPanel";
import { CondensationWherePanel } from "./CondensationWherePanel";

type RiskTab = "verdict" | "where" | "numbers" | "assumptions";

const TABS: { id: RiskTab; label: string }[] = [
  { id: "verdict", label: "Verdict" },
  { id: "where", label: "Where & when" },
  { id: "numbers", label: "Numbers" },
  { id: "assumptions", label: "Assumptions" },
];

export function CondensationRiskModal({
  projectId,
  assembly,
  materials,
  result,
  loading,
  error,
  canEdit,
  onClose,
  onEditMaterial,
}: {
  projectId: string;
  assembly: Assembly;
  materials: ProjectMaterial[];
  result: AssemblyCondensationResponse | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  onClose: () => void;
  onEditMaterial: (materialId: string, focus: ProjectMaterialEditorInitialFocus) => void;
}) {
  const [activeTab, setActiveTab] = useState<RiskTab>("verdict");
  const presentation = condensationChipPresentation(result, loading, error !== null);
  const missingMaterials = useMemo(
    () => groupMissingVaporIssues(result?.issues ?? [], materials),
    [materials, result?.issues],
  );

  return (
    <ModalDialog
      id="condensation-risk-modal"
      title={`Condensation risk — ${assembly.name}`}
      titleId="condensation-risk-title"
      onClose={onClose}
      resizable
    >
      <div className="condensation-risk-modal">
        <header className="condensation-risk-summary">
          <span
            className="chip chip--md condensation-risk-summary__chip"
            data-tone={presentation.tone}
            data-muted={presentation.muted || undefined}
          >
            {presentation.label}
          </span>
          <p>Modified Glaser / ISO 13788 monthly design screen.</p>
        </header>
        <div className="pill-tab-list" role="tablist" aria-label="Condensation risk detail">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="pill-tab"
              role="tab"
              id={`condensation-${tab.id}-tab`}
              aria-selected={activeTab === tab.id}
              aria-controls={`condensation-${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onKeyDown={(event) => selectTabFromKeyboard(event, tab.id, setActiveTab)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <section
          id={`condensation-${activeTab}-panel`}
          className="condensation-risk-panel"
          role="tabpanel"
          aria-labelledby={`condensation-${activeTab}-tab`}
        >
          {renderPanel({
            activeTab,
            projectId,
            assembly,
            materials,
            result,
            loading,
            error,
            missingMaterials,
            canEdit,
            onEditMaterial,
          })}
        </section>
        <DialogActions
          busy={false}
          error={null}
          submitLabel="Done"
          onClose={onClose}
          onConfirm={onClose}
        />
      </div>
    </ModalDialog>
  );
}

type MissingMaterial = {
  id: string;
  name: string;
  layerNumbers: number[];
  datum: "sd required" | "µ or sd required";
  focus: ProjectMaterialEditorInitialFocus;
};

function renderPanel({
  activeTab,
  projectId,
  assembly,
  materials,
  result,
  loading,
  error,
  missingMaterials,
  canEdit,
  onEditMaterial,
}: {
  activeTab: RiskTab;
  projectId: string;
  assembly: Assembly;
  materials: ProjectMaterial[];
  result: AssemblyCondensationResponse | null;
  loading: boolean;
  error: string | null;
  missingMaterials: MissingMaterial[];
  canEdit: boolean;
  onEditMaterial: (materialId: string, focus: ProjectMaterialEditorInitialFocus) => void;
}) {
  if (loading) return <p className="condensation-risk-empty">Calculating the live draft…</p>;
  if (error || !result) {
    return (
      <div className="condensation-risk-empty">
        <h3>Result unavailable</h3>
        <p>{error ?? "The condensation result could not be loaded."}</p>
      </div>
    );
  }
  if (result.status.state === "not_screened") {
    const adjacent = result.status.flags.includes("unconditioned_space_not_screened");
    return (
      <div className="condensation-risk-empty">
        <h3>Not screened</h3>
        <p>
          {adjacent
            ? "Adjacent-space temperature is not modelled, so this assembly has no defensible exterior boundary condition."
            : "Ground-contact assemblies are outside the scope of this air-facing ISO 13788 screen."}
        </p>
      </div>
    );
  }
  if (result.status.state === "blocked") {
    if (missingMaterials.length > 0) {
      return (
        <div className="condensation-missing">
          <div>
            <h3>Vapour data needed</h3>
            <p>Enter the missing diffusion input to calculate this assembly.</p>
          </div>
          <ul className="condensation-missing__list">
            {missingMaterials.map((material) => (
              <li key={material.id}>
                <div>
                  <strong>{material.name}</strong>
                  <span>
                    Layer {material.layerNumbers.join(", ")} · {material.datum}
                  </span>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onEditMaterial(material.id, material.focus)}
                  >
                    Enter vapour data
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {result.status.flags.includes("missing_climate_source") ? (
            <ClimateNeeded projectId={projectId} />
          ) : null}
        </div>
      );
    }
    if (result.status.flags.includes("missing_climate_source")) {
      return <ClimateNeeded projectId={projectId} />;
    }
    return (
      <div className="condensation-risk-empty">
        <h3>Inputs need review</h3>
        <ul>
          {result.issues.map((issue) => (
            <li key={`${issue.code}-${issue.layer_id}-${issue.segment_id}`}>{issue.message}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (activeTab === "verdict") {
    return <CondensationVerdictPanel result={result} />;
  }
  if (activeTab === "where") {
    return (
      <CondensationWherePanel
        key={result.input_hash}
        assembly={assembly}
        materials={materials}
        result={result}
      />
    );
  }
  return (
    <div className="condensation-risk-empty">
      <h3>{TABS.find((tab) => tab.id === activeTab)?.label}</h3>
      <p>This detail tier is wired to the live result and is completed in the next phase.</p>
    </div>
  );
}

function ClimateNeeded({ projectId }: { projectId: string }) {
  return (
    <div className="condensation-climate-needed">
      <div>
        <h3>Climate source needed</h3>
        <p>Attach a PHI, Phius, or custom monthly climate record before screening.</p>
      </div>
      <NavLink className="secondary-button" to={`/projects/${projectId}/climate`}>
        Open Climate
      </NavLink>
    </div>
  );
}

function groupMissingVaporIssues(
  issues: CondensationIssue[],
  materials: ProjectMaterial[],
): MissingMaterial[] {
  const names = new Map(materials.map((material) => [material.id, material.name]));
  const grouped = new Map<string, MissingMaterial>();
  for (const issue of issues) {
    if (!isMissingVapourIssue(issue) || issue.project_material_id === null) {
      continue;
    }
    const current = grouped.get(issue.project_material_id) ?? {
      id: issue.project_material_id,
      name:
        issue.project_material_name ??
        names.get(issue.project_material_id) ??
        issue.project_material_id,
      layerNumbers: [],
      datum: issue.code === "missing_membrane_sd" ? "sd required" : "µ or sd required",
      focus: issue.code === "missing_membrane_sd" ? "vapour_sd" : "vapour_mu",
    };
    if (issue.layer_order !== null && !current.layerNumbers.includes(issue.layer_order + 1)) {
      current.layerNumbers.push(issue.layer_order + 1);
    }
    if (issue.code === "missing_membrane_sd") {
      current.datum = "sd required";
      current.focus = "vapour_sd";
    }
    grouped.set(issue.project_material_id, current);
  }
  return [...grouped.values()].map((item) => ({
    ...item,
    layerNumbers: item.layerNumbers.sort((left, right) => left - right),
  }));
}

function selectTabFromKeyboard(
  event: KeyboardEvent<HTMLButtonElement>,
  current: RiskTab,
  select: (tab: RiskTab) => void,
): void {
  const currentIndex = TABS.findIndex((tab) => tab.id === current);
  let nextIndex: number | null = null;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
  if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = TABS.length - 1;
  if (nextIndex === null) return;
  event.preventDefault();
  const next = TABS[nextIndex];
  if (!next) return;
  select(next.id);
  document.getElementById(`condensation-${next.id}-tab`)?.focus();
}
