import * as Popover from "@radix-ui/react-popover";
import { useCallback, useMemo, useRef, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getFilterOperators,
  getOperatorDef,
  type FilterOperatorDef,
} from "../fields/filterOperators";
import { defaultOperatorForField } from "../lib";
import { generatedId } from "../../../lib/ids";
import type { FieldDef, FilterCondition, FilterOperator } from "../types";

// Phase 4 §4.5: Filter popover. Stacked rule rows wired to user-intent
// `view.filter` via a single `onFilterChange(next)` callback. Each
// gesture (add / edit / delete) produces a fully-shaped new array and
// fires `onFilterChange` exactly once (L8.2). Operator semantics live
// in the field-type registry — this component knows nothing about how
// a rule evaluates.
//
// Step 3 ships without drag-to-reorder; Step 5 adds @dnd-kit/sortable
// handles to each row. Until then rules render in their array order
// and the "+ Add condition" footer appends to the tail.

export type FilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  rules: FilterCondition[];
  onFilterChange: (next: FilterCondition[]) => void;
  filterableFieldDefs: FieldDef[];
};

export function FilterPopover({
  open,
  onOpenChange,
  trigger,
  rules,
  onFilterChange,
  filterableFieldDefs,
}: FilterPopoverProps) {
  // Stable React keys for the rule list. `view.filter` is array-positional;
  // we generate a fresh id whenever a rule is appended and re-use the
  // existing id when a rule is replaced in place. This lets the React
  // tree (and Step 5's dnd-kit ids) stay stable across edits without
  // persisting any id to the view state.
  const ruleIdsRef = useRef<string[]>([]);
  if (ruleIdsRef.current.length !== rules.length) {
    if (rules.length > ruleIdsRef.current.length) {
      while (ruleIdsRef.current.length < rules.length) {
        ruleIdsRef.current.push(generatedId("filt"));
      }
    } else {
      ruleIdsRef.current = ruleIdsRef.current.slice(0, rules.length);
    }
  }

  const handleAddRule = useCallback(() => {
    const firstField = filterableFieldDefs[0];
    if (!firstField) return;
    const operator = defaultOperatorForField(firstField);
    if (!operator) return;
    const next: FilterCondition = { fieldKey: firstField.field_key, operator };
    ruleIdsRef.current.push(generatedId("filt"));
    onFilterChange([...rules, next]);
  }, [filterableFieldDefs, onFilterChange, rules]);

  const handleRuleChange = useCallback(
    (index: number, next: FilterCondition) => {
      const updated = [...rules];
      updated[index] = next;
      onFilterChange(updated);
    },
    [onFilterChange, rules],
  );

  const handleRuleRemove = useCallback(
    (index: number) => {
      ruleIdsRef.current.splice(index, 1);
      onFilterChange(rules.filter((_rule, i) => i !== index));
    },
    [onFilterChange, rules],
  );

  // Phase 4 §4.5 + Step 5: drag-to-reorder via @dnd-kit/sortable.
  // Tests fire `DndContext.onDragEnd` directly so we keep the sensor
  // setup default but rely on the active/over id pair carried by the
  // event rather than the pointer position.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIndex = ruleIdsRef.current.indexOf(String(active.id));
      const toIndex = ruleIdsRef.current.indexOf(String(over.id));
      if (fromIndex < 0 || toIndex < 0) return;
      const nextRules = [...rules];
      const [moved] = nextRules.splice(fromIndex, 1);
      if (!moved) return;
      nextRules.splice(toIndex, 0, moved);
      const nextIds = [...ruleIdsRef.current];
      const [movedId] = nextIds.splice(fromIndex, 1);
      if (movedId !== undefined) nextIds.splice(toIndex, 0, movedId);
      ruleIdsRef.current = nextIds;
      onFilterChange(nextRules);
    },
    [onFilterChange, rules],
  );

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-view-popover"
          align="end"
          sideOffset={6}
          aria-label="Filter rules"
        >
          <div className="data-table-view-popover-heading">Filter</div>
          <div className="data-table-view-popover-subheading">In this view, show records</div>
          {rules.length === 0 ? (
            <div className="data-table-view-popover-empty">No filters applied to this view.</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ruleIdsRef.current.slice(0, rules.length)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="data-table-view-popover-rules" role="list">
                  {rules.map((rule, index) => (
                    <FilterRuleRow
                      key={ruleIdsRef.current[index] ?? `filt-${index}`}
                      ruleId={ruleIdsRef.current[index] ?? `filt-${index}`}
                      index={index}
                      rule={rule}
                      fieldDefs={filterableFieldDefs}
                      onChange={(next) => handleRuleChange(index, next)}
                      onRemove={() => handleRuleRemove(index)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <button
            type="button"
            className="data-table-view-popover-add"
            onClick={handleAddRule}
            disabled={filterableFieldDefs.length === 0}
          >
            + Add filter rule
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type FilterRuleRowProps = {
  ruleId: string;
  index: number;
  rule: FilterCondition;
  fieldDefs: FieldDef[];
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
};

function FilterRuleRow({ ruleId, index, rule, fieldDefs, onChange, onRemove }: FilterRuleRowProps) {
  const fieldDef = fieldDefs.find((def) => def.field_key === rule.fieldKey);
  const operators = useMemo(() => getFilterOperators(fieldDef), [fieldDef]);
  const operatorDef = getOperatorDef(rule.operator);
  const sortable = useSortable({ id: ruleId });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  const handleFieldChange = (nextFieldKey: string) => {
    const nextField = fieldDefs.find((def) => def.field_key === nextFieldKey);
    const nextOperator = defaultOperatorForField(nextField);
    if (!nextField || !nextOperator) return;
    // Changing the field resets operator to the new catalogue's first
    // entry and clears the value slots — the previous operator's shape
    // may not match (e.g. text contains "abc" → number eq doesn't read
    // a string value).
    onChange({ fieldKey: nextFieldKey, operator: nextOperator });
  };

  const handleOperatorChange = (nextOperator: FilterOperator) => {
    const nextDef = getOperatorDef(nextOperator);
    if (!nextDef) return;
    // If the new operator's value shape differs from the current one,
    // clear the value slots so we don't carry stale data of the wrong
    // type into the next render's evaluator.
    if (!operatorDef || nextDef.shape.kind !== operatorDef.shape.kind) {
      onChange({ fieldKey: rule.fieldKey, operator: nextOperator });
      return;
    }
    onChange({ ...rule, operator: nextOperator });
  };

  return (
    <li
      className="data-table-view-popover-rule"
      ref={sortable.setNodeRef}
      style={style}
      data-dragging={sortable.isDragging ? "true" : undefined}
    >
      <span className="data-table-view-popover-conjunction">{index === 0 ? "Where" : "And"}</span>
      <select
        aria-label="Filter field"
        className="data-table-view-popover-select"
        value={rule.fieldKey}
        onChange={(event) => handleFieldChange(event.target.value)}
      >
        {fieldDefs.map((def) => (
          <option key={def.field_key} value={def.field_key}>
            {def.display_name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter operator"
        className="data-table-view-popover-select"
        value={rule.operator}
        onChange={(event) => handleOperatorChange(event.target.value as FilterOperator)}
      >
        {operators.map((op) => (
          <option key={op.operator} value={op.operator}>
            {op.label}
          </option>
        ))}
      </select>
      <div className="data-table-view-popover-value">
        <FilterValueEditor
          rule={rule}
          operatorDef={operatorDef}
          fieldDef={fieldDef}
          onChange={onChange}
        />
      </div>
      <button
        type="button"
        className="data-table-view-popover-remove"
        aria-label="Remove filter rule"
        onClick={onRemove}
      >
        🗑
      </button>
      <button
        type="button"
        className="data-table-view-popover-drag"
        aria-label={`Reorder rule ${index + 1}`}
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        ⋮⋮
      </button>
    </li>
  );
}

type FilterValueEditorProps = {
  rule: FilterCondition;
  operatorDef: FilterOperatorDef | undefined;
  fieldDef: FieldDef | undefined;
  onChange: (next: FilterCondition) => void;
};

function FilterValueEditor({ rule, operatorDef, fieldDef, onChange }: FilterValueEditorProps) {
  if (!operatorDef) return null;
  switch (operatorDef.shape.kind) {
    case "none":
      return null;
    case "string":
      return (
        <input
          type="text"
          aria-label="Filter value"
          className="data-table-view-popover-input"
          value={rule.value ?? ""}
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
          placeholder="Enter a value"
        />
      );
    case "number":
      return (
        <input
          type="number"
          step="any"
          aria-label="Filter value"
          className="data-table-view-popover-input"
          value={rule.value ?? ""}
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
          placeholder="Enter a number"
        />
      );
    case "numberPair": {
      const [lo = "", hi = ""] = rule.valuePair ?? [];
      return (
        <div className="data-table-view-popover-range">
          <input
            type="number"
            step="any"
            aria-label="Filter lower bound"
            className="data-table-view-popover-input"
            value={lo}
            onChange={(event) => onChange({ ...rule, valuePair: [event.target.value, hi] })}
          />
          <span className="data-table-view-popover-range-sep">and</span>
          <input
            type="number"
            step="any"
            aria-label="Filter upper bound"
            className="data-table-view-popover-input"
            value={hi}
            onChange={(event) => onChange({ ...rule, valuePair: [lo, event.target.value] })}
          />
        </div>
      );
    }
    case "optionIdList": {
      const options = fieldDef?.options ?? [];
      const selected = new Set(rule.valueList ?? []);
      const toggle = (optionId: string) => {
        const next = new Set(selected);
        if (next.has(optionId)) next.delete(optionId);
        else next.add(optionId);
        onChange({ ...rule, valueList: Array.from(next) });
      };
      const summary = selected.size === 0 ? "Select options" : `${selected.size} selected`;
      return (
        <details className="data-table-view-popover-disclosure">
          <summary>{summary}</summary>
          <ul className="data-table-view-popover-options">
            {options.map((option) => (
              <li key={option.id}>
                <label className="data-table-view-popover-option">
                  <input
                    type="checkbox"
                    checked={selected.has(option.id)}
                    onChange={() => toggle(option.id)}
                  />
                  <span
                    className="single-select-pill"
                    style={{ "--option-color": option.color } as CSSProperties}
                  >
                    {option.label}
                  </span>
                </label>
              </li>
            ))}
            {options.length === 0 ? (
              <li className="data-table-view-popover-options-empty">
                No options defined for this field.
              </li>
            ) : null}
          </ul>
        </details>
      );
    }
  }
}
