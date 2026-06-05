import * as Popover from "@radix-ui/react-popover";
import { useMemo, type CSSProperties } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AutocompleteSelect } from "../../AutocompleteSelect";
import { useSortableRules } from "../hooks/useSortableRules";
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
  const sortable = useSortableRules(rules, onSortChange, "sort");

  const usedFieldKeys = useMemo(() => new Set(rules.map((rule) => rule.fieldKey)), [rules]);
  const unusedFieldDefs = useMemo(
    () => sortableFieldDefs.filter((def) => !usedFieldKeys.has(def.field_key)),
    [sortableFieldDefs, usedFieldKeys],
  );
  const canAddRule = unusedFieldDefs.length > 0;

  const handleAddRule = () => {
    const next = unusedFieldDefs[0];
    if (!next) return;
    sortable.appendRule({ fieldKey: next.field_key, direction: "asc" });
  };

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
            <DndContext
              sensors={sortable.sensors}
              collisionDetection={closestCenter}
              onDragEnd={sortable.onDragEnd}
            >
              <SortableContext items={sortable.ids} strategy={verticalListSortingStrategy}>
                <ul className="data-table-view-popover-rules" role="list">
                  {rules.map((rule, index) => {
                    const fieldOptions = sortableFieldDefs.filter(
                      (def) => def.field_key === rule.fieldKey || !usedFieldKeys.has(def.field_key),
                    );
                    return (
                      <SortRuleRow
                        key={sortable.ids[index]!}
                        ruleId={sortable.ids[index]!}
                        index={index}
                        rule={rule}
                        fieldOptions={fieldOptions}
                        onChange={(next) => sortable.updateRuleAt(index, next)}
                        onRemove={() => sortable.removeRuleAt(index)}
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
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
  ruleId: string;
  index: number;
  rule: SortRule;
  fieldOptions: FieldDef[];
  onChange: (next: SortRule) => void;
  onRemove: () => void;
};

function SortRuleRow({ ruleId, index, rule, fieldOptions, onChange, onRemove }: SortRuleRowProps) {
  const sortable = useSortable({ id: ruleId });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <li
      className="data-table-view-popover-rule is-sort"
      ref={sortable.setNodeRef}
      style={style}
      data-dragging={sortable.isDragging ? "true" : undefined}
    >
      <AutocompleteSelect
        aria-label="Sort field"
        className="data-table-view-popover-select"
        value={rule.fieldKey}
        compact
        options={fieldOptions.map((def) => ({
          value: def.field_key,
          label: def.display_name,
        }))}
        onChange={(fieldKey) => onChange({ ...rule, fieldKey })}
      />
      <AutocompleteSelect
        aria-label="Sort direction"
        className="data-table-view-popover-select"
        value={rule.direction}
        compact
        options={[
          { value: "asc", label: "A → Z" },
          { value: "desc", label: "Z → A" },
        ]}
        onChange={(direction) => onChange({ ...rule, direction: direction as "asc" | "desc" })}
      />
      <button
        type="button"
        className="data-table-view-popover-remove"
        aria-label="Remove sort rule"
        onClick={onRemove}
      >
        ×
      </button>
      <button
        type="button"
        className="data-table-view-popover-drag"
        aria-label={`Reorder sort rule ${index + 1}`}
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        ⋮⋮
      </button>
    </li>
  );
}
