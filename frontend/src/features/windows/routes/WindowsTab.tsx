import { useEffect, useId, useMemo, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { useFrameTypesQuery, useGlazingTypesQuery } from "../../catalogs/hooks";
import type { CatalogFrameType, CatalogGlazingType } from "../../catalogs/types";
import { projectDownloadUrl } from "../../project_document/api";
import { isInvalidProjectDocumentError } from "../../project_document/lib";
import type { ProjectDetail } from "../../projects/types";
import { useReplaceWindowTypesSliceMutation, useWindowTypesSliceQuery } from "../hooks";
import { RefreshDialog } from "../refresh/RefreshDialog";
import {
  useInvalidateWindowTypesRefresh,
  useWindowTypesRefreshReportQuery,
} from "../refresh/hooks";
import {
  applyRefToWindowTypes,
  findSlotRef,
  refreshActionLabel,
  refreshSlotLookupKey,
} from "../refresh/lib";
import type { RefreshSlotName, RefreshSlotReport } from "../refresh/types";
import {
  FRAME_SIDES,
  OVERRIDE_TRACKER_FIELD,
  applyUValueOverride,
  frameRefFromCatalog,
  glazingRefFromCatalog,
  naturalSortByName,
  newWindowType,
  replaceWindowTypeInList,
  updateElementInWindowType,
} from "../lib";
import type {
  CatalogPickableRow,
  FrameRef,
  GlazingRef,
  PickableRef,
  WindowElement,
  WindowTypeEntry,
} from "../types";

export function WindowsTab({ project }: { project: ProjectDetail }) {
  const sliceQuery = useWindowTypesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const isEditor = project.access_mode === "editor";
  const isLocked = project.active_version?.locked ?? false;
  const canEdit = isEditor && !isLocked && Boolean(project.active_version_id);
  // Catalog routes require an authenticated user and the picker is the only
  // consumer here; skip them in Viewer / locked contexts to avoid 401 noise.
  const frameTypesQuery = useFrameTypesQuery(false, canEdit);
  const glazingTypesQuery = useGlazingTypesQuery(false, canEdit);
  const replaceMutation = useReplaceWindowTypesSliceMutation(project.id, project.active_version_id);
  const refreshQuery = useWindowTypesRefreshReportQuery(
    project.id,
    project.active_version_id,
    canEdit,
  );
  const invalidateRefresh = useInvalidateWindowTypesRefresh(project.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeRefresh, setActiveRefresh] = useState<{
    windowTypeId: string;
    elementId: string;
    slot: RefreshSlotName;
  } | null>(null);

  const windowTypes = sliceQuery.data?.window_types;
  const sortedTypes = useMemo(
    () => (windowTypes ? naturalSortByName(windowTypes) : []),
    [windowTypes],
  );
  const refreshSlotsByTarget = useMemo(() => {
    const out = new Map<string, RefreshSlotReport>();
    for (const slot of refreshQuery.data?.slots ?? []) {
      out.set(refreshSlotLookupKey(slot.window_type_id, slot.element_id, slot.slot), slot);
    }
    return out;
  }, [refreshQuery.data?.slots]);

  useEffect(() => {
    if (!windowTypes) return;
    if (selectedId && windowTypes.some((entry) => entry.id === selectedId)) return;
    setSelectedId(windowTypes[0]?.id ?? null);
  }, [windowTypes, selectedId]);

  if (sliceQuery.isLoading) {
    return (
      <section className="tab-panel" aria-labelledby="windows-title">
        <h2 id="windows-title">Windows</h2>
        <p>Loading window types...</p>
      </section>
    );
  }

  if (sliceQuery.isError || !sliceQuery.data) {
    const invalidDocument = isInvalidProjectDocumentError(sliceQuery.error);
    return (
      <section className="tab-panel" aria-labelledby="windows-title">
        <h2 id="windows-title">Windows</h2>
        <p role="alert">{errorMessage(sliceQuery.error, "Could not load window types.")}</p>
        {invalidDocument && project.active_version_id ? (
          <p className="form-note">
            Editing is disabled for this version.{" "}
            <a href={projectDownloadUrl(project.id, project.active_version_id)}>
              Download raw project JSON
            </a>
          </p>
        ) : null}
      </section>
    );
  }

  const slice = sliceQuery.data;
  const selectedWindowType = sortedTypes.find((entry) => entry.id === selectedId) ?? null;

  const commitWindowTypes = async (nextList: WindowTypeEntry[]): Promise<boolean> => {
    if (!canEdit) return false;
    setActionError(null);
    try {
      await replaceMutation.mutateAsync({
        current: slice,
        payload: { window_types: nextList },
      });
      void invalidateRefresh();
      return true;
    } catch (error) {
      setActionError(errorMessage(error, "Could not update window types."));
      return false;
    }
  };

  const handleAdd = async () => {
    if (!canEdit) return;
    const next = newWindowType(slice.window_types);
    await commitWindowTypes([...slice.window_types, next]);
    setSelectedId(next.id);
  };

  const handleUpdateWindowType = (next: WindowTypeEntry) =>
    commitWindowTypes(replaceWindowTypeInList(slice.window_types, next));

  const refreshSlot = activeRefresh
    ? (refreshSlotsByTarget.get(
        refreshSlotLookupKey(
          activeRefresh.windowTypeId,
          activeRefresh.elementId,
          activeRefresh.slot,
        ),
      ) ?? null)
    : null;
  const refreshRef =
    activeRefresh && refreshSlot
      ? findSlotRef(
          slice.window_types,
          activeRefresh.windowTypeId,
          activeRefresh.elementId,
          activeRefresh.slot,
        )
      : null;

  const applyRefresh = async (nextRef: FrameRef | GlazingRef) => {
    if (!activeRefresh) return;
    const nextList = applyRefToWindowTypes(
      slice.window_types,
      activeRefresh.windowTypeId,
      activeRefresh.elementId,
      activeRefresh.slot,
      nextRef,
    );
    const saved = await commitWindowTypes(nextList);
    if (saved) setActiveRefresh(null);
  };

  return (
    <section className="tab-panel windows-panel" aria-labelledby="windows-title">
      <div className="status-heading">
        <div>
          <h2 id="windows-title">Windows</h2>
          <p>Pick frame and glazing types from the catalogs.</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={() => void handleAdd()}>
            Add window type
          </button>
        ) : null}
      </div>
      {isLocked ? (
        <p className="draft-banner">
          This version is locked. Save As to copy it into a new version.
        </p>
      ) : null}
      {slice.source === "draft" ? (
        <p className="draft-banner">Unsaved Window Types draft restored</p>
      ) : null}
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="windows-layout">
        <WindowTypeSidebar items={sortedTypes} selectedId={selectedId} onSelect={setSelectedId} />
        {selectedWindowType ? (
          <WindowTypeDetail
            windowType={selectedWindowType}
            canEdit={canEdit}
            frameTypes={frameTypesQuery.data ?? []}
            frameTypesLoading={frameTypesQuery.isLoading}
            glazingTypes={glazingTypesQuery.data ?? []}
            glazingTypesLoading={glazingTypesQuery.isLoading}
            getRefreshSlot={(elementId, slot) =>
              refreshSlotsByTarget.get(
                refreshSlotLookupKey(selectedWindowType.id, elementId, slot),
              ) ?? null
            }
            onReviewRefresh={(elementId, slot) =>
              setActiveRefresh({ windowTypeId: selectedWindowType.id, elementId, slot })
            }
            onChange={(next) => void handleUpdateWindowType(next)}
          />
        ) : (
          <p className="empty-state">{emptyDetailMessage(sortedTypes.length, canEdit)}</p>
        )}
      </div>
      {refreshSlot && refreshRef ? (
        <RefreshDialog
          slot={refreshSlot}
          refValue={refreshRef}
          busy={replaceMutation.isPending}
          onCancel={() => setActiveRefresh(null)}
          onApply={(nextRef) => void applyRefresh(nextRef)}
        />
      ) : null}
    </section>
  );
}

function emptyDetailMessage(typeCount: number, canEdit: boolean): string {
  if (typeCount > 0) return "Select a window type from the list.";
  return canEdit
    ? "No window types yet. Add one to start picking frames and glazing."
    : "No window types in this version yet.";
}

function WindowTypeSidebar({
  items,
  selectedId,
  onSelect,
}: {
  items: WindowTypeEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <aside className="windows-sidebar" aria-label="Window types">
        <p className="empty-state">No window types</p>
      </aside>
    );
  }
  return (
    <aside className="windows-sidebar" aria-label="Window types">
      <ul>
        {items.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={entry.id === selectedId ? "active" : ""}
              onClick={() => onSelect(entry.id)}
            >
              {entry.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function WindowTypeDetail({
  windowType,
  canEdit,
  frameTypes,
  frameTypesLoading,
  glazingTypes,
  glazingTypesLoading,
  getRefreshSlot,
  onReviewRefresh,
  onChange,
}: {
  windowType: WindowTypeEntry;
  canEdit: boolean;
  frameTypes: CatalogFrameType[];
  frameTypesLoading: boolean;
  glazingTypes: CatalogGlazingType[];
  glazingTypesLoading: boolean;
  getRefreshSlot: (elementId: string, slot: RefreshSlotName) => RefreshSlotReport | null;
  onReviewRefresh: (elementId: string, slot: RefreshSlotName) => void;
  onChange: (next: WindowTypeEntry) => void;
}) {
  return (
    <div className="windows-detail">
      <header className="windows-detail-header">
        <h3>{windowType.name}</h3>
      </header>
      <div className="windows-elements">
        {windowType.elements.map((element) => (
          <WindowElementCard
            key={element.id}
            element={element}
            canEdit={canEdit}
            frameTypes={frameTypes}
            frameTypesLoading={frameTypesLoading}
            glazingTypes={glazingTypes}
            glazingTypesLoading={glazingTypesLoading}
            getRefreshSlot={getRefreshSlot}
            onReviewRefresh={onReviewRefresh}
            onChange={(nextElement) =>
              onChange(updateElementInWindowType(windowType, element.id, () => nextElement))
            }
          />
        ))}
      </div>
    </div>
  );
}

function WindowElementCard({
  element,
  canEdit,
  frameTypes,
  frameTypesLoading,
  glazingTypes,
  glazingTypesLoading,
  getRefreshSlot,
  onReviewRefresh,
  onChange,
}: {
  element: WindowElement;
  canEdit: boolean;
  frameTypes: CatalogFrameType[];
  frameTypesLoading: boolean;
  glazingTypes: CatalogGlazingType[];
  glazingTypesLoading: boolean;
  getRefreshSlot: (elementId: string, slot: RefreshSlotName) => RefreshSlotReport | null;
  onReviewRefresh: (elementId: string, slot: RefreshSlotName) => void;
  onChange: (next: WindowElement) => void;
}) {
  return (
    <article className="window-element-card">
      <h4>Element</h4>
      <div className="window-element-frames">
        {FRAME_SIDES.map((side) => (
          <CatalogPickerSlot
            key={side}
            label={`Frame · ${side}`}
            ariaLabel={`Frame ${side} U-value`}
            testId={`frame-${side}-catalog-origin`}
            value={element.frames[side]}
            canEdit={canEdit}
            catalogRows={frameTypes}
            catalogRowsLoading={frameTypesLoading}
            refFromCatalogRow={frameRefFromCatalog}
            refreshSlot={getRefreshSlot(element.id, `frame.${side}`)}
            onReviewRefresh={() => onReviewRefresh(element.id, `frame.${side}`)}
            onChange={(next) =>
              onChange({ ...element, frames: { ...element.frames, [side]: next } })
            }
          />
        ))}
      </div>
      <CatalogPickerSlot
        label="Glazing"
        ariaLabel="Glazing U-value"
        testId="glazing-catalog-origin"
        className="window-slot-glazing"
        value={element.glazing}
        canEdit={canEdit}
        catalogRows={glazingTypes}
        catalogRowsLoading={glazingTypesLoading}
        refFromCatalogRow={glazingRefFromCatalog}
        refreshSlot={getRefreshSlot(element.id, "glazing")}
        onReviewRefresh={() => onReviewRefresh(element.id, "glazing")}
        onChange={(next) => onChange({ ...element, glazing: next })}
      />
    </article>
  );
}

function CatalogPickerSlot<TRow extends CatalogPickableRow, TRef extends PickableRef>({
  label,
  ariaLabel,
  testId,
  className,
  value,
  canEdit,
  catalogRows,
  catalogRowsLoading,
  refFromCatalogRow,
  refreshSlot,
  onReviewRefresh,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  testId: string;
  className?: string;
  value: TRef | null;
  canEdit: boolean;
  catalogRows: TRow[];
  catalogRowsLoading: boolean;
  refFromCatalogRow: (row: TRow) => TRef;
  refreshSlot?: RefreshSlotReport | null;
  onReviewRefresh: () => void;
  onChange: (next: TRef | null) => void;
}) {
  const selectId = useId();
  const overrides = value?.catalog_origin?.local_overrides ?? [];
  const refreshLabel = canEdit && refreshSlot ? refreshActionLabel(refreshSlot.state) : null;
  return (
    <div className={className ? `window-slot ${className}` : "window-slot"}>
      <label htmlFor={selectId} className="window-slot-label">
        {label}
      </label>
      <select
        id={selectId}
        value={value?.catalog_origin?.catalog_record_id ?? ""}
        disabled={!canEdit || catalogRowsLoading}
        onChange={(event) => {
          const recordId = event.target.value;
          if (!recordId) {
            onChange(null);
            return;
          }
          const row = catalogRows.find((entry) => entry.id === recordId);
          if (!row) return;
          onChange(refFromCatalogRow(row));
        }}
      >
        <option value="">(none)</option>
        {catalogRows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      {value ? (
        <div className="window-slot-detail">
          {value.catalog_origin ? (
            <span className="catalog-origin-badge" data-testid={testId}>
              Catalog
            </span>
          ) : null}
          {refreshLabel ? (
            <button
              type="button"
              className="text-button refresh-slot-button"
              onClick={onReviewRefresh}
            >
              {refreshLabel}
            </button>
          ) : null}
          <UValueOverrideInput
            value={value.u_value_w_m2k}
            canEdit={canEdit}
            isOverridden={overrides.includes(OVERRIDE_TRACKER_FIELD)}
            onChange={(nextValue) => onChange(applyUValueOverride(value, nextValue))}
            ariaLabel={ariaLabel}
          />
        </div>
      ) : null}
    </div>
  );
}

function UValueOverrideInput({
  value,
  canEdit,
  isOverridden,
  onChange,
  ariaLabel,
}: {
  value: number | null;
  canEdit: boolean;
  isOverridden: boolean;
  onChange: (next: number | null) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(formatNumber(value));
  useEffect(() => {
    setDraft(formatNumber(value));
  }, [value]);
  return (
    <label className="window-slot-uvalue">
      <span>U-value (W/m²K)</span>
      <input
        type="number"
        step="0.001"
        min="0"
        aria-label={ariaLabel}
        value={draft}
        disabled={!canEdit}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const parsed = draft.trim() === "" ? null : Number.parseFloat(draft);
          const next = parsed !== null && Number.isFinite(parsed) ? parsed : null;
          if (next !== value) onChange(next);
        }}
      />
      {isOverridden ? <span className="override-badge">Override</span> : null}
    </label>
  );
}

function formatNumber(value: number | null): string {
  return value === null ? "" : String(value);
}
