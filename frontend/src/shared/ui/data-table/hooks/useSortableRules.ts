import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { generatedId } from "../../../lib/ids";

// Shared scaffolding for the Filter and Sort popovers' stacked rule
// lists. Owns the parallel `ids` array that React + dnd-kit need as
// stable per-rule keys, the dnd-kit sensor setup, and the drag-end
// handler that reorders the rule array and the id array in lockstep.
//
// `ids` lives in `useState` (not a ref mutated during render) so the
// reconciliation is observable to React and StrictMode-safe. The hook
// resyncs the id array length whenever the rules array length changes
// out-of-band (e.g. consumer-driven reset).
export type SortableRules<TRule> = {
  ids: string[];
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  appendRule: (rule: TRule) => void;
  removeRuleAt: (index: number) => void;
  updateRuleAt: (index: number, rule: TRule) => void;
};

export function useSortableRules<TRule>(
  rules: TRule[],
  onChange: (next: TRule[]) => void,
  idPrefix: string,
): SortableRules<TRule> {
  const [ids, setIds] = useState<string[]>(() => rules.map(() => generatedId(idPrefix)));

  // Resync when the rules array length changes from outside the hook
  // (e.g. Reset view clearing the stack). Extend with fresh ids when
  // longer, slice when shorter. Same-length updates leave ids alone.
  useEffect(() => {
    if (rules.length === ids.length) return;
    setIds((prev) => {
      if (rules.length > prev.length) {
        const extra = Array.from({ length: rules.length - prev.length }, () =>
          generatedId(idPrefix),
        );
        return [...prev, ...extra];
      }
      return prev.slice(0, rules.length);
    });
    // We only respond to length changes — the rule values themselves
    // don't need new ids.
  }, [rules.length, ids.length, idPrefix]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const appendRule = useCallback(
    (rule: TRule) => {
      setIds((prev) => [...prev, generatedId(idPrefix)]);
      onChange([...rules, rule]);
    },
    [idPrefix, onChange, rules],
  );

  const removeRuleAt = useCallback(
    (index: number) => {
      setIds((prev) => prev.filter((_id, i) => i !== index));
      onChange(rules.filter((_rule, i) => i !== index));
    },
    [onChange, rules],
  );

  const updateRuleAt = useCallback(
    (index: number, rule: TRule) => {
      const next = [...rules];
      next[index] = rule;
      onChange(next);
    },
    [onChange, rules],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIndex = ids.indexOf(String(active.id));
      const toIndex = ids.indexOf(String(over.id));
      if (fromIndex < 0 || toIndex < 0) return;
      const nextRules = [...rules];
      const [movedRule] = nextRules.splice(fromIndex, 1);
      if (!movedRule) return;
      nextRules.splice(toIndex, 0, movedRule);
      const nextIds = [...ids];
      const [movedId] = nextIds.splice(fromIndex, 1);
      if (movedId !== undefined) nextIds.splice(toIndex, 0, movedId);
      setIds(nextIds);
      onChange(nextRules);
    },
    [ids, onChange, rules],
  );

  // Defensive: the visible `ids` we hand to dnd-kit's SortableContext
  // must always match `rules.length`. The useEffect above closes the
  // length gap on the next tick, but we don't want consumers to ever
  // render with a mismatched pair within a single render.
  const safeIds = useMemo(() => {
    if (ids.length === rules.length) return ids;
    if (ids.length > rules.length) return ids.slice(0, rules.length);
    return [
      ...ids,
      ...Array.from({ length: rules.length - ids.length }, (_v, i) => `${idPrefix}-tmp-${i}`),
    ];
  }, [idPrefix, ids, rules.length]);

  return {
    ids: safeIds,
    sensors,
    onDragEnd,
    appendRule,
    removeRuleAt,
    updateRuleAt,
  };
}
