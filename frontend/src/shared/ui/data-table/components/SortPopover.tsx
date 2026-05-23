import * as Popover from "@radix-ui/react-popover";
import { useCallback, useMemo, useRef } from "react";
import { generatedId } from "../../../lib/ids";
import type { FieldDef, SortRule } from "../types";

// Phase 4 §4.6: Sort popover. Stacked rule rows wired to user-intent
// `view.sort` via a single `onSortChange(next)` callback (L8.2). Sort
// has no operator/value editor — each rule is just field + direction.
// `sortRows` in `lib.ts` already walks the rule array in order so the
// data path needs no change.
//
// §12 Q1 resolution: a field can only appear in one sort rule. The
// field picker excludes fields already used by earlier rules; the
// "+ Add another sort" button disables when all sortable fields are
// used. Sort-direction labels use AirTable's literal A → Z / Z → A
// arrows regardless of field type (§12 Q8).

export type SortPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  rules: SortRule[];
  onSortChange: (next: SortRule[]) => void;
  sortableFieldDefs: FieldDef[];
};

export function SortPopover({
  open,
  onOpenChange,
  trigger,
  rules,
  onSortChange,
  sortableFieldDefs,
}: SortPopoverProps) {
  const ruleIdsRef = useRef<string[]>([]);
  if (ruleIdsRef.current.length !== rules.length) {
    if (rules.length > ruleIdsRef.current.length) {
      while (ruleIdsRef.current.length < rules.length) {
        ruleIdsRef.current.push(generatedId("sort"));
      }
    } else {
      ruleIdsRef.current = ruleIdsRef.current.slice(0, rules.length);
    }
  }

  const usedFieldKeys = useMemo(
    () => new Set(rules.map((rule) => rule.fieldKey)),
    [rules],
  );
  const unusedFieldDefs = useMemo(
    () => sortableFieldDefs.filter((def) => !usedFieldKeys.has(def.field_key)),
    [sortableFieldDefs, usedFieldKeys],
  );
  const canAddRule = unusedFieldDefs.length > 0;

  const handleAddRule = useCallback(() => {
    const next = unusedFieldDefs[0];
    if (!next) return;
    ruleIdsRef.current.push(generatedId("sort"));
    onSortChange([...rules, { fieldKey: next.field_key, direction: "asc" }]);
  }, [onSortChange, rules, unusedFieldDefs]);

  const handleRuleChange = useCallback(
    (index: number, next: SortRule) => {
      const updated = [...rules];
      updated[index] = next;
      onSortChange(updated);
    },
    [onSortChange, rules],
  );

  const handleRuleRemove = useCallback(
    (index: number) => {
      ruleIdsRef.current.splice(index, 1);
      onSortChange(rules.filter((_rule, i) => i !== index));
    },
    [onSortChange, rules],
  );

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-view-popover is-sort"
          align="end"
          sideOffset={6}
          aria-label="Sort rules"
        >
          <div className="data-table-view-popover-heading">Sort by</div>
          {rules.length === 0 ? (
            <div className="data-table-view-popover-empty">No sort rules applied.</div>
          ) : (
            <ul className="data-table-view-popover-rules" role="list">
              {rules.map((rule, index) => {
                const fieldOptions = sortableFieldDefs.filter(
                  (def) =>
                    def.field_key === rule.fieldKey || !usedFieldKeys.has(def.field_key),
                );
                return (
                  <SortRuleRow
                    key={ruleIdsRef.current[index] ?? `sort-${index}`}
                    rule={rule}
                    fieldOptions={fieldOptions}
                    onChange={(next) => handleRuleChange(index, next)}
                    onRemove={() => handleRuleRemove(index)}
                  />
                );
              })}
            </ul>
          )}
          <button
            type="button"
            className="data-table-view-popover-add"
            onClick={handleAddRule}
            disabled={!canAddRule}
          >
            + Add another sort
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type SortRuleRowProps = {
  rule: SortRule;
  fieldOptions: FieldDef[];
  onChange: (next: SortRule) => void;
  onRemove: () => void;
};

function SortRuleRow({ rule, fieldOptions, onChange, onRemove }: SortRuleRowProps) {
  return (
    <li className="data-table-view-popover-rule is-sort">
      <select
        aria-label="Sort field"
        className="data-table-view-popover-select"
        value={rule.fieldKey}
        onChange={(event) => onChange({ ...rule, fieldKey: event.target.value })}
      >
        {fieldOptions.map((def) => (
          <option key={def.field_key} value={def.field_key}>
            {def.display_name}
          </option>
        ))}
      </select>
      <select
        aria-label="Sort direction"
        className="data-table-view-popover-select"
        value={rule.direction}
        onChange={(event) =>
          onChange({ ...rule, direction: event.target.value as "asc" | "desc" })
        }
      >
        <option value="asc">A → Z</option>
        <option value="desc">Z → A</option>
      </select>
      <button
        type="button"
        className="data-table-view-popover-remove"
        aria-label="Remove sort rule"
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  );
}
