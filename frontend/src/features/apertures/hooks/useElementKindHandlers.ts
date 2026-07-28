import { useCallback, useEffect, useMemo, useState } from "react";
import { hasGlazedAssignments } from "../empty-panel";
import { useApertureBuilderStore } from "../store/builder-store";
import type { ApertureElement, ApertureElementKind } from "../types";

export function useElementKindHandlers({
  apertureId,
  elements,
  onSetElementKind,
  disabled = false,
}: {
  apertureId: string;
  elements: readonly ApertureElement[];
  onSetElementKind?: (
    elementIds: string[],
    elementKind: ApertureElementKind,
  ) => Promise<boolean> | boolean;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<{
    apertureId: string;
    elementIds: string[];
  } | null>(null);
  const dropUndoEntries = useApertureBuilderStore((state) => state.dropUndoEntriesForElements);
  const pendingElements = useMemo(() => {
    if (pending?.apertureId !== apertureId) return [];
    const pendingIds = new Set(pending.elementIds);
    return elements.filter((element) => pendingIds.has(element.id));
  }, [apertureId, elements, pending]);

  useEffect(() => setPending(null), [apertureId]);

  const applyKind = useCallback(
    async (targets: readonly ApertureElement[], kind: ApertureElementKind) => {
      const changed = targets.filter((element) => element.kind !== kind);
      if (changed.length === 0 || !onSetElementKind) return false;
      const ids = changed.map((element) => element.id);
      try {
        const succeeded = await onSetElementKind(ids, kind);
        if (!succeeded) return false;
        if (kind === "void") dropUndoEntries(apertureId, ids);
        return true;
      } catch {
        // The route mutation owns error display; retain local undo/pick state.
        return false;
      }
    },
    [apertureId, dropUndoEntries, onSetElementKind],
  );

  const requestElementKind = useCallback(
    (elementIds: readonly string[], kind: ApertureElementKind) => {
      if (disabled) return;
      const requestedIds = new Set(elementIds);
      const targets = elements.filter(
        (element) => requestedIds.has(element.id) && element.kind !== kind,
      );
      if (kind === "void" && targets.some(hasGlazedAssignments)) {
        setPending({ apertureId, elementIds: targets.map((element) => element.id) });
        return;
      }
      void applyKind(targets, kind);
    },
    [apertureId, applyKind, disabled, elements],
  );

  const confirmPending = useCallback(async () => {
    const targets = pendingElements;
    if (await applyKind(targets, "void")) setPending(null);
  }, [applyKind, pendingElements]);

  return {
    pendingElements,
    requestElementKind,
    confirmPending,
    cancelPending: () => setPending(null),
  };
}
