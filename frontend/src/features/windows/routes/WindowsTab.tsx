import "../windows.css";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { useFrameTypesQuery, useGlazingTypesQuery } from "../../catalogs/hooks";
import type { ProjectDetail } from "../../projects/types";
import { WindowsErrorState } from "../components/WindowsErrorState";
import { WindowsLoadingState } from "../components/WindowsLoadingState";
import { WindowsPanelHeader } from "../components/WindowsPanelHeader";
import { WindowsPanelNotices } from "../components/WindowsPanelNotices";
import { WindowsRefreshDialogs } from "../components/WindowsRefreshDialogs";
import { WindowsTypeLayout } from "../components/WindowsTypeLayout";
import { useReplaceWindowTypesSliceMutation, useWindowTypesSliceQuery } from "../hooks";
import { isReviewableRefreshState } from "../lib/isReviewableRefreshState";
import { useWindowsRefreshController } from "../lib/useWindowsRefreshController";
import {
  useInvalidateWindowTypesRefresh,
  useWindowTypesRefreshReportQuery,
} from "../refresh/hooks";
import { refreshSlotLookupKey } from "../refresh/lib";
import type { RefreshSlotReport } from "../refresh/types";
import { naturalSortByName, newWindowType, replaceWindowTypeInList } from "../lib";
import type { WindowTypeEntry } from "../types";

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

  const windowTypes = sliceQuery.data?.window_types;
  const sortedTypes = useMemo(
    () => (windowTypes ? naturalSortByName(windowTypes) : []),
    [windowTypes],
  );
  const refreshSlots = useMemo(() => {
    const byTarget = new Map<string, RefreshSlotReport>();
    const reviewable: RefreshSlotReport[] = [];
    for (const slot of refreshQuery.data?.slots ?? []) {
      byTarget.set(refreshSlotLookupKey(slot.window_type_id, slot.element_id, slot.slot), slot);
      if (isReviewableRefreshState(slot.state)) reviewable.push(slot);
    }
    return { byTarget, reviewable };
  }, [refreshQuery.data?.slots]);

  useEffect(() => {
    if (!windowTypes) return;
    if (selectedId && windowTypes.some((entry) => entry.id === selectedId)) return;
    setSelectedId(windowTypes[0]?.id ?? null);
  }, [windowTypes, selectedId]);

  const slice = sliceQuery.data;
  const commitWindowTypes = async (nextList: WindowTypeEntry[]): Promise<boolean> => {
    if (!canEdit || !slice) return false;
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
  const refreshController = useWindowsRefreshController({
    windowTypes: slice?.window_types ?? [],
    refreshSlots,
    commitWindowTypes,
  });

  if (sliceQuery.isLoading) {
    return <WindowsLoadingState />;
  }

  if (sliceQuery.isError || !slice) {
    return (
      <WindowsErrorState
        error={sliceQuery.error}
        projectId={project.id}
        activeVersionId={project.active_version_id}
      />
    );
  }

  const selectedWindowType = sortedTypes.find((entry) => entry.id === selectedId) ?? null;
  const reviewableRefreshSlots = refreshSlots.reviewable;

  const handleAdd = async () => {
    if (!canEdit) return;
    const next = newWindowType(slice.window_types);
    await commitWindowTypes([...slice.window_types, next]);
    setSelectedId(next.id);
  };

  const handleUpdateWindowType = (next: WindowTypeEntry) =>
    commitWindowTypes(replaceWindowTypeInList(slice.window_types, next));

  return (
    <section className="tab-panel windows-panel" aria-labelledby="windows-title">
      <WindowsPanelHeader
        canEdit={canEdit}
        onReviewAll={refreshController.openReviewAll}
        onAdd={() => void handleAdd()}
      />
      <WindowsPanelNotices
        canEdit={canEdit}
        reviewableCount={reviewableRefreshSlots.length}
        isLocked={isLocked}
        source={slice.source}
        actionError={actionError}
        onReviewAll={refreshController.openReviewAll}
      />
      <WindowsTypeLayout
        items={sortedTypes}
        selectedId={selectedId}
        selectedWindowType={selectedWindowType}
        canEdit={canEdit}
        frameTypes={frameTypesQuery.data ?? []}
        frameTypesLoading={frameTypesQuery.isLoading}
        glazingTypes={glazingTypesQuery.data ?? []}
        glazingTypesLoading={glazingTypesQuery.isLoading}
        getRefreshSlot={(elementId, slot) =>
          selectedWindowType
            ? (refreshSlots.byTarget.get(
                refreshSlotLookupKey(selectedWindowType.id, elementId, slot),
              ) ?? null)
            : null
        }
        onSelect={setSelectedId}
        onReviewRefresh={(elementId, slot) =>
          selectedWindowType &&
          refreshController.startRefresh({ windowTypeId: selectedWindowType.id, elementId, slot })
        }
        onChange={(next) => void handleUpdateWindowType(next)}
      />
      <WindowsRefreshDialogs
        refreshSlot={refreshController.refreshSlot}
        refreshRef={refreshController.refreshRef}
        replaceBusy={replaceMutation.isPending}
        reviewAllOpen={refreshController.reviewAllOpen}
        reviewableRefreshSlots={reviewableRefreshSlots}
        windowTypes={slice.window_types}
        onCancelRefresh={refreshController.cancelRefresh}
        onApplyRefresh={(nextRef) => void refreshController.applyRefresh(nextRef)}
        onCloseReviewAll={refreshController.closeReviewAll}
        onReview={(target) => {
          refreshController.closeReviewAll();
          setSelectedId(target.windowTypeId);
          refreshController.startRefresh(target);
        }}
      />
    </section>
  );
}
