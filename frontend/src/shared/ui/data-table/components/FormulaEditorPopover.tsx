import * as Popover from "@radix-ui/react-popover";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  COMPUTED_ERROR_MESSAGES,
  FormulaMissingRefError,
  FormulaParseError,
  FormulaResourceLimitError,
  FormulaUnsupportedFunctionError,
  SOURCE_LENGTH_MAX,
  collectFieldRefs,
  createFuse,
  evaluate,
  parse,
  resolveRefs,
  type EvalResult,
  type FieldRegistryEntry,
  type FormulaAST,
} from "../lib/formula";
import { useElementAnchorRef } from "../lib/popoverAnchor";
import { schemaMutationErrorMessage } from "../lib/schemaMutationErrors";
import { FormulaFieldPalette } from "./FormulaFieldPalette";

const FORMULA_TEXTAREA_THRESHOLD = 80;
const FORMULA_MODAL_THRESHOLD = 240;

export type FormulaEditorFieldShape = {
  id: string;
  display_name: string;
};

export type FormulaEditorFocusedRow = {
  id: string;
  values: Record<string, unknown>;
};

export type FormulaEditorSubmitPayload = {
  source: string;
};

export type FormulaEditorPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  fieldDef: FormulaEditorFieldShape;
  fieldRegistry: ReadonlyArray<FieldRegistryEntry>;
  // `null` when no row is focused — the preview renders a hint
  // instead of evaluating.
  focusedRow: FormulaEditorFocusedRow | null;
  // Callers editing an existing formula should pass
  // `rebuildSourceFromStoredAst(storedAst, fieldRegistry)` so a
  // referenced field's rename absorbs silently on next open.
  initialSource: string;
  onSubmit: (payload: FormulaEditorSubmitPayload) => Promise<void>;
};

type LocalParseState =
  | { kind: "empty" }
  | { kind: "ok"; ast: FormulaAST; deps: ReadonlyArray<string> }
  | { kind: "missing_ref"; display_name: string }
  | { kind: "cycle"; field_id: string }
  | { kind: "parse_error"; message: string; offset: number }
  | { kind: "resource_limit"; limit: string; actual: number; max: number }
  | { kind: "unsupported_function"; name: string };

export function FormulaEditorPopover({
  open,
  onOpenChange,
  anchorElement,
  fieldDef,
  fieldRegistry,
  focusedRow,
  initialSource,
  onSubmit,
}: FormulaEditorPopoverProps) {
  const [source, setSource] = useState(initialSource);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const sourceInputId = useId();
  const previewLabelId = useId();

  useEffect(() => {
    if (!open) return;
    setSource(initialSource);
    setSubmitError(null);
    setPending(false);
  }, [initialSource, open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const length = el.value.length;
      el.setSelectionRange(length, length);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  const localState = useMemo<LocalParseState>(() => {
    if (source.trim() === "") return { kind: "empty" };
    let ast: FormulaAST;
    try {
      ast = parse(source);
    } catch (err) {
      if (err instanceof FormulaParseError) {
        return { kind: "parse_error", message: err.message, offset: err.offset };
      }
      if (err instanceof FormulaResourceLimitError) {
        return {
          kind: "resource_limit",
          limit: err.limit_name,
          actual: err.actual,
          max: err.max_value,
        };
      }
      if (err instanceof FormulaUnsupportedFunctionError) {
        return { kind: "unsupported_function", name: err.function_name };
      }
      throw err;
    }
    let resolved: FormulaAST;
    try {
      resolved = resolveRefs(ast, fieldRegistry);
    } catch (err) {
      if (err instanceof FormulaMissingRefError) {
        return { kind: "missing_ref", display_name: err.display_name };
      }
      throw err;
    }
    const deps = collectFieldRefs(resolved);
    if (deps.includes(fieldDef.id)) {
      return { kind: "cycle", field_id: fieldDef.id };
    }
    return { kind: "ok", ast: resolved, deps };
  }, [source, fieldRegistry, fieldDef.id]);

  const previewResult = useMemo<EvalResult | null>(() => {
    if (localState.kind !== "ok") return null;
    if (focusedRow === null) return null;
    const accessor = (fieldId: string): unknown => focusedRow.values[fieldId] ?? null;
    return evaluate(localState.ast, accessor, { fuse: createFuse() });
  }, [localState, focusedRow]);

  const localErrorMessage = useMemo(() => formatLocalError(localState), [localState]);
  const canSubmit = localState.kind === "ok" && !pending;

  // The popover may close between insertion and the next animation
  // frame; cancel the pending caret restore so the focus call doesn't
  // fire against a stale (or unmounted) element.
  const pendingCaretFrameRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pendingCaretFrameRef.current !== null) {
        cancelAnimationFrame(pendingCaretFrameRef.current);
      }
    },
    [],
  );

  const handleInsertToken = useCallback((token: string) => {
    const el = inputRef.current;
    if (!el) {
      setSource((prev) => (prev ? `${prev}${token}` : token));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
    if (next.length > SOURCE_LENGTH_MAX) return;
    setSource(next);
    if (pendingCaretFrameRef.current !== null) {
      cancelAnimationFrame(pendingCaretFrameRef.current);
    }
    pendingCaretFrameRef.current = requestAnimationFrame(() => {
      pendingCaretFrameRef.current = null;
      const updated = inputRef.current;
      if (!updated) return;
      const caret = start + token.length;
      updated.focus();
      updated.setSelectionRange(caret, caret);
    });
  }, []);

  const handleSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (!canSubmit) return;
      setPending(true);
      setSubmitError(null);
      try {
        await onSubmit({ source });
        onOpenChange(false);
      } catch (error) {
        setSubmitError(schemaMutationErrorMessage(error, "Could not save formula."));
      } finally {
        setPending(false);
      }
    },
    [canSubmit, onOpenChange, onSubmit, source],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onOpenChange(false);
      }
    },
    [onOpenChange, pending],
  );

  const handleSourceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && event.currentTarget.tagName === "INPUT") {
        event.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const paletteEntries = useMemo(
    () => fieldRegistry.filter((entry) => entry.field_id !== fieldDef.id),
    [fieldRegistry, fieldDef.id],
  );

  const useTextarea = source.length >= FORMULA_TEXTAREA_THRESHOLD;
  const escalateToModal = source.length >= FORMULA_MODAL_THRESHOLD;

  const virtualAnchorRef = useElementAnchorRef(anchorElement);

  const sharedInputProps = {
    id: sourceInputId,
    ref: (node: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = node;
    },
    value: source,
    maxLength: SOURCE_LENGTH_MAX,
    spellCheck: false,
    autoComplete: "off",
    "aria-invalid": localErrorMessage ? true : undefined,
    "aria-describedby": previewLabelId,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>,
    ) => setSource(event.target.value),
    onKeyDown: handleSourceKeyDown,
  } as const;

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {virtualAnchorRef ? <Popover.Anchor virtualRef={virtualAnchorRef} /> : null}
      <Popover.Portal>
        <Popover.Content
          className={joinClassNames(
            "data-table-add-field-popover",
            "data-table-formula-editor",
            escalateToModal && "data-table-formula-editor-modal",
          )}
          side="bottom"
          align="start"
          sideOffset={6}
          role="dialog"
          aria-label={`Edit formula for ${fieldDef.display_name}`}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onKeyDown={handleKeyDown}
        >
          <form
            className="data-table-add-field-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <label className="data-table-add-field-label" htmlFor={sourceInputId}>
              Expression
            </label>
            {useTextarea ? (
              <textarea
                {...sharedInputProps}
                className="data-table-add-field-textarea data-table-formula-editor-source"
                rows={escalateToModal ? 8 : 4}
              />
            ) : (
              <input
                {...sharedInputProps}
                type="text"
                className="data-table-add-field-input data-table-formula-editor-source"
              />
            )}
            <span className="data-table-add-field-counter" aria-hidden>
              {source.length}/{SOURCE_LENGTH_MAX}
            </span>

            <FormulaFieldPalette
              entries={paletteEntries}
              disabled={source.length >= SOURCE_LENGTH_MAX}
              onInsert={handleInsertToken}
            />

            <FormulaPreviewPanel
              labelId={previewLabelId}
              localState={localState}
              localErrorMessage={localErrorMessage}
              focusedRow={focusedRow}
              previewResult={previewResult}
            />

            {submitError ? (
              <p className="form-error data-table-add-field-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="data-table-add-field-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit}>
                {pending ? "Saving…" : "Save formula"}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type FormulaPreviewPanelProps = {
  labelId: string;
  localState: LocalParseState;
  localErrorMessage: string | null;
  focusedRow: FormulaEditorFocusedRow | null;
  previewResult: EvalResult | null;
};

function FormulaPreviewPanel({
  labelId,
  localState,
  localErrorMessage,
  focusedRow,
  previewResult,
}: FormulaPreviewPanelProps) {
  const panel = previewPanelContent(localState, localErrorMessage, focusedRow, previewResult);
  return (
    <div
      id={labelId}
      className={joinClassNames("data-table-formula-editor-preview", panel.modifier)}
      role="status"
      aria-live="polite"
    >
      {panel.body}
    </div>
  );
}

type PreviewPanel = { modifier: string | null; body: React.ReactNode };

function previewPanelContent(
  localState: LocalParseState,
  localErrorMessage: string | null,
  focusedRow: FormulaEditorFocusedRow | null,
  previewResult: EvalResult | null,
): PreviewPanel {
  if (localErrorMessage) {
    return {
      modifier: "data-table-formula-editor-preview-error",
      body: localErrorMessage,
    };
  }
  if (localState.kind === "empty") {
    return {
      modifier: "data-table-formula-editor-preview-empty",
      body: "Enter an expression to preview.",
    };
  }
  if (focusedRow === null) {
    return { modifier: null, body: "Focus a row to preview." };
  }
  if (previewResult === null) {
    return { modifier: null, body: null };
  }
  if (!previewResult.ok) {
    return {
      modifier: "data-table-formula-editor-preview-error",
      body: (
        <>
          <span className="data-table-formula-editor-preview-label">Preview</span>
          <span className="data-table-formula-editor-preview-value">
            #ERROR — {COMPUTED_ERROR_MESSAGES[previewResult.code]}
          </span>
        </>
      ),
    };
  }
  return {
    modifier: null,
    body: (
      <>
        <span className="data-table-formula-editor-preview-label">Preview</span>
        <span className="data-table-formula-editor-preview-value">
          {formatPreviewValue(previewResult.value)}
        </span>
      </>
    ),
  };
}

function formatPreviewValue(value: string | number | boolean | null): string {
  if (value === null) return "(blank)";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return value;
}

function formatLocalError(state: LocalParseState): string | null {
  switch (state.kind) {
    case "empty":
    case "ok":
      return null;
    case "parse_error":
      return `Couldn't parse the formula: ${state.message} (position ${state.offset}).`;
    case "resource_limit":
      return `Formula exceeds ${state.limit} limit (${state.actual}/${state.max}). Simplify the expression and try again.`;
    case "unsupported_function":
      return `Function '${state.name}' is not supported.`;
    case "missing_ref":
      return `Formula references a field that doesn't exist in this table: ${state.display_name}.`;
    case "cycle":
      return "This formula references itself, which would create a cycle.";
  }
}

function joinClassNames(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
