// Shared types for the slice-table feature shell. Every feature tab
// that follows the "slice + DataTable + draft conflict" shape (Rooms,
// ERV, Pumps, Fans, Thermal Bridge, …) consumes these via
// `useSliceTableController` + `<SliceTableShell>`. The types are
// deliberately slim — they describe *only* the payload-shape and
// conflict-messaging contracts the controller needs; everything else
// (formula registry, view-state, modal UI) is consumer-owned.

import type {
  AddCustomFieldRequest,
  BuildEmptyRow,
  CellWrite,
  EditCustomFieldBundleRequest,
  FieldOption,
  RowDeletePayload,
  RowDuplicatePayload,
  RowInsertPayload,
  ViewState,
  WriteOp,
} from "../types";
import type { TableSchema } from "../hooks/useTableSchema";

// Cell-write delta carried by the cell / paste WriteOps. Keyed by
// option-list key (the namespaced single-select id, e.g.
// "rooms.floor_level" or "rooms.cf_abc123"). `newOptions` are
// freshly-created options the gesture wants persisted; `removedOptions`
// are option ids the inverse leg wants removed.
export type OptionDelta = Record<string, FieldOption[]>;
export type RemovedOptionDelta = Record<string, string[]>;

// Payload builders the controller calls to translate a `WriteOp` /
// schema mutation into the slice-specific replace body that the
// backend `replaceSlice` endpoint accepts. Each tab implements one of
// these against its own `TSlice` / `TRow` / `TPayload` triple.
export interface SlicePayloadBuilders<TSlice, TRow extends { id: string }, TPayload> {
  fromCellWrites(
    slice: TSlice,
    writes: CellWrite[],
    newOptions: OptionDelta,
    removedOptions: RemovedOptionDelta,
  ): TPayload;
  fromRowInsert(slice: TSlice, rows: RowInsertPayload[], build: BuildEmptyRow<TRow>): TPayload;
  fromRowDelete(slice: TSlice, rows: RowDeletePayload[]): TPayload;
  // Phase 3b/3c — clone each `sourceRow` snapshot client-side and
  // produce a slice-replace payload. Slice-replace consumers do not
  // have a per-row CRUD endpoint, so the cloning lives in the
  // controller boundary (PRD §8 / decision D-1).
  fromRowDuplicate(slice: TSlice, rows: RowDuplicatePayload[]): TPayload;
  // Pre-flight validation run on every replace payload. Return the
  // user-facing error message, or null when the payload is valid.
  validate(payload: TPayload): string | null;
  // Optional — only required for tabs that expose the legacy
  // single-select option editor. Takes a "replacements" map keyed by
  // outgoing option id and produces a payload that swaps references on
  // every affected row.
  replaceOptions?(
    slice: TSlice,
    optionKey: string,
    options: FieldOption[],
    replacements: Record<string, string | null>,
  ): TPayload;
  // Optional — only required for tabs that own an "active row" modal
  // that must surface a draft-conflict banner when a remote write
  // mutates the same row. Rooms uses this; ERV / Pumps / Fans (no
  // modal) skip it.
  remoteSliceChangesActiveRow?(slice: TSlice, incoming: TSlice, activeRow: TRow): boolean;
  // Optional — only required for tabs that expose the legacy
  // single-select option editor. Maps cell writes that fire alongside
  // the option-list edit into the `replacements` shape that
  // `replaceOptions` accepts.
  collapseCellWritesToReplacements?(
    slice: TSlice,
    optionKey: string,
    cellWrites: ReadonlyArray<CellWrite> | undefined,
  ): Record<string, string | null>;
  // Optional — narrow `op.after.field_key` to a value the
  // `replaceOptions` signature accepts. Default: any string is
  // accepted. Rooms uses this to enforce the `RoomOptionKey` union.
  isLegacyOptionKey?(key: string): boolean;
}

// User-facing copy for the three conflict states the controller can
// land in. Centralized so every tab uses identical wording.
export interface ConflictMessages {
  activeRowConflict: string;
  deleteConflict: string;
  versionLocked: string;
}

// The "edit blocker" surfaced by the controller. The shell renders the
// banner; consumers may also forward it into modals as `frozenReason`.
export type EditBlocker =
  | { kind: "draft-conflict"; message: string }
  | { kind: "version-locked"; message: string };

// The controller's public surface. Consumers compose this with their
// own table component (e.g. `<RoomsTable>`) and any feature-specific
// modal state. The shape is intentionally stable across tabs.
// `TRow` is intentionally absent from this interface — none of the
// exposed methods produce a `TRow` directly. The row identity flows
// through `BuildEmptyRow<TRow>` (consumer-supplied) and the controller
// merely forwards it through `onWrite`'s `rowInsert` branch.
export interface SliceTableController<TSlice> {
  tableSchema: TableSchema;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onResetView: () => void;
  viewLoading: boolean;
  onWrite: (op: WriteOp) => Promise<void>;
  handleAddCustomField: (request: AddCustomFieldRequest) => Promise<{ newFieldKey: string }>;
  handleEditCustomFieldBundle: (request: EditCustomFieldBundleRequest) => Promise<void>;
  handleDeleteCustomField: (fieldKey: string) => Promise<void>;
  handleDuplicateCustomField: (fieldKey: string) => Promise<{ newFieldKey: string }>;
  editBlocker: EditBlocker | null;
  setEditBlocker: (blocker: EditBlocker | null) => void;
  actionError: string | null;
  setActionError: (message: string | null) => void;
  canEdit: boolean;
  // Access-principal class (member+), independent of the version lock. Export
  // affordances (CSV/Phius) gate on this so an editor on a locked version can
  // still export (CP-7); mutations gate on `canEdit`.
  isEditor: boolean;
  isLocked: boolean;
  reloadDraft: () => Promise<void>;
  // Surfaced for consumers that compose a wrapper modal-save path
  // (Rooms) or want to gate a footer "+" button on pending state.
  isReplacePending: boolean;
  // Wrap a custom mutation (e.g. RoomModal's `saveRoom`) in the same
  // draft-conflict / version-locked handling the controller uses for
  // its own writes. Returns the operation's result, or undefined when
  // `canEdit` is false.
  runWithConflictHandling<T>(
    run: () => Promise<T>,
    conflictMessage: string,
    fallbackMessage: string,
  ): Promise<T | undefined>;
  // For wrapper flows that must run their own preflight request before
  // delegating to `onWrite` (for example cascade previews). Regular table
  // writes already call this internally.
  resolveSliceForWrite: () => Promise<TSlice>;
  // Consumers call this from their broadcast-channel `onRemoteSlice`
  // handler (e.g. inside `useRoomsDraftBroadcast`). The controller
  // applies its own active-row gate before surfacing the banner.
  notifyRemoteSlice: (incoming: TSlice) => void;
}
