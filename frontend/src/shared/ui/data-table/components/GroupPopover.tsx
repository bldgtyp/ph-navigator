import * as Popover from "@radix-ui/react-popover";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AutocompleteSelect } from "../../AutocompleteSelect";
import { useSortableRules } from "../hooks/useSortableRules";
import type { FieldDef, GroupRule } from "../types";

// Group popover. Stacked rule rows wired to `view.group` via a
// single `onGroupChange(next)` callback. Direction labels follow
// AirTable's group-popover phrasing (`First → Last` / `Last → First`)
// rather than the Sort popover's `A → Z` / `Z → A`; the internal
// direction stays "asc" | "desc". The popover-header right-side
// carries `Collapse all` / `Expand all` text actions.

export const MAX_GROUP_RULES = 4;

export type GroupPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  rules: GroupRule[];
  onGroupChange: (next: GroupRule[]) => void;
  groupableFieldDefs: FieldDef[];
  onCollapseAll: () => void;
  onExpandAll: () => void;
  canToggleExpand: boolean;
};

export function GroupPopover({
  open,
  onOpenChange,
  trigger,
  rules,
  onGroupChange,
  groupableFieldDefs,
  onCollapseAll,
  onExpandAll,
  canToggleExpand,
}: GroupPopoverProps) {
  const sortable = useSortableRules(rules, onGroupChange, "group");

  const usedFieldKeys = useMemo(() => new Set(rules.map((rule) => rule.fieldKey)), [rules]);
  const unusedFieldDefs = useMemo(
    () => groupableFieldDefs.filter((def) => !usedFieldKeys.has(def.field_key)),
    [groupableFieldDefs, usedFieldKeys],
  );
  const canAddRule = rules.length < MAX_GROUP_RULES && unusedFieldDefs.length > 0;

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
          className="data-table-view-popover is-group"
          align="end"
          sideOffset={6}
          aria-label="Group rules"
        >
          <div className="data-table-view-popover-header">
            <div className="data-table-view-popover-heading">Group by</div>
            <div className="data-table-view-popover-header-actions">
              <button
                type="button"
                className="data-table-view-popover-text-action"
                onClick={onCollapseAll}
                disabled={!canToggleExpand}
              >
                Collapse all
              </button>
              <button
                type="button"
                className="data-table-view-popover-text-action"
                onClick={onExpandAll}
                disabled={!canToggleExpand}
              >
                Expand all
              </button>
            </div>
          </div>
          {rules.length === 0 ? (
            <div className="data-table-view-popover-empty">No group rules applied.</div>
          ) : (
            <DndContext
              sensors={sortable.sensors}
              collisionDetection={closestCenter}
              onDragEnd={sortable.onDragEnd}
            >
              <SortableContext items={sortable.ids} strategy={verticalListSortingStrategy}>
                <ul className="data-table-view-popover-rules" role="list">
                  {rules.map((rule, index) => {
                    const fieldOptions = groupableFieldDefs.filter(
                      (def) => def.field_key === rule.fieldKey || !usedFieldKeys.has(def.field_key),
                    );
                    return (
                      <GroupRuleRow
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
            + Add subgroup
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type GroupRuleRowProps = {
  ruleId: string;
  index: number;
  rule: GroupRule;
  fieldOptions: FieldDef[];
  onChange: (next: GroupRule) => void;
  onRemove: () => void;
};

function GroupRuleRow({
  ruleId,
  index,
  rule,
  fieldOptions,
  onChange,
  onRemove,
}: GroupRuleRowProps) {
  const sortable = useSortable({ id: ruleId });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <li
      className="data-table-view-popover-rule is-group"
      ref={sortable.setNodeRef}
      style={style}
      data-dragging={sortable.isDragging ? "true" : undefined}
    >
      <AutocompleteSelect
        aria-label="Group field"
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
        aria-label="Group direction"
        className="data-table-view-popover-select"
        value={rule.direction}
        compact
        options={[
          { value: "asc", label: "First → Last" },
          { value: "desc", label: "Last → First" },
        ]}
        onChange={(direction) => onChange({ ...rule, direction: direction as "asc" | "desc" })}
      />
      <button
        type="button"
        className="data-table-view-popover-remove"
        aria-label="Remove group rule"
        onClick={onRemove}
      >
        ×
      </button>
      <button
        type="button"
        className="data-table-view-popover-drag"
        aria-label={`Reorder group rule ${index + 1}`}
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        ⋮⋮
      </button>
    </li>
  );
}
