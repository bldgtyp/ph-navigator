import type { BuildEmptyRow, FieldOption, WriteOp } from "../types";
import type { OptionDelta, RemovedOptionDelta, SlicePayloadBuilders } from "./types";
import { flattenBatchedRowInserts } from "./rowInsertBatching";

type OptionState = { option?: FieldOption; present: boolean };

export function buildCoalescedTablePayload<TSlice, TRow extends { id: string }, TPayload>(
  slice: TSlice,
  metadata: readonly unknown[],
  builders: SlicePayloadBuilders<TSlice, TRow, TPayload>,
  buildEmptyRow: BuildEmptyRow<TRow>,
): TPayload {
  const ops = metadata.filter(isBatchableWriteOp);
  const insertedRows = flattenBatchedRowInserts(
    ops.filter((op) => op.kind === "rowInsert").map((op) => op.rows),
  );
  const cellOps = ops.filter((op) => op.kind === "cell");
  const writes = cellOps.flatMap((op) => op.writes);
  const { newOptions, removedOptions } = foldOptionDeltas(cellOps);
  let projection = slice;
  let payload: TPayload | null = null;
  if (insertedRows.length > 0) {
    payload = builders.fromRowInsert(projection, insertedRows, buildEmptyRow);
    projection = payload as unknown as TSlice;
  }
  if (
    writes.length > 0 ||
    Object.keys(newOptions).length > 0 ||
    Object.keys(removedOptions).length > 0
  ) {
    payload = builders.fromCellWrites(projection, writes, newOptions, removedOptions);
  }
  if (payload === null) throw new Error("Cannot build an empty coalesced table payload.");
  return payload;
}

function isBatchableWriteOp(
  value: unknown,
): value is Extract<WriteOp, { kind: "cell" | "rowInsert" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "cell" || value.kind === "rowInsert")
  );
}

function foldOptionDeltas(ops: ReadonlyArray<Extract<WriteOp, { kind: "cell" }>>): {
  newOptions: OptionDelta;
  removedOptions: RemovedOptionDelta;
} {
  const byField = new Map<string, Map<string, OptionState>>();
  const fieldState = (fieldKey: string) => {
    const existing = byField.get(fieldKey);
    if (existing) return existing;
    const created = new Map<string, OptionState>();
    byField.set(fieldKey, created);
    return created;
  };
  for (const op of ops) {
    for (const [fieldKey, options] of Object.entries(op.newOptions ?? {})) {
      const state = fieldState(fieldKey);
      for (const option of options) state.set(option.id, { option, present: true });
    }
    for (const [fieldKey, optionIds] of Object.entries(op.removedOptions ?? {})) {
      const state = fieldState(fieldKey);
      for (const optionId of optionIds) {
        const existing = state.get(optionId);
        state.set(optionId, { option: existing?.option, present: false });
      }
    }
  }
  const newOptions: OptionDelta = {};
  const removedOptions: RemovedOptionDelta = {};
  for (const [fieldKey, states] of byField) {
    const added = Array.from(states.values()).flatMap((state) =>
      state.present && state.option ? [state.option] : [],
    );
    const removed = Array.from(states.entries()).flatMap(([id, state]) =>
      state.present ? [] : [id],
    );
    if (added.length > 0) newOptions[fieldKey] = added;
    if (removed.length > 0) removedOptions[fieldKey] = removed;
  }
  return { newOptions, removedOptions };
}
