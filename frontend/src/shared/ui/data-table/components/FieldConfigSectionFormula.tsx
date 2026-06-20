import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
  type ReactNode,
} from "react";
import {
  COMPUTED_ERROR_MESSAGES,
  SOURCE_LENGTH_MAX,
  createFuse,
  evaluate,
  formatLocalFormulaError,
  parseFormulaSource,
  type EvalResult,
  type FieldRegistryEntry,
  type LocalFormulaState,
} from "../lib/formula";
import { FormulaFieldPalette } from "./FormulaFieldPalette";

const FORMULA_TEXTAREA_THRESHOLD = 80;
const FORMULA_MODAL_THRESHOLD = 240;

export type FormulaPreviewRowSnapshot = {
  id: string;
  values: Record<string, unknown>;
};

export type FormulaDraftState = {
  source: string;
  dirty: boolean;
  valid: boolean;
};

export type FieldConfigSectionFormulaProps = {
  fieldId: string;
  initialSource: string;
  fieldRegistry: ReadonlyArray<FieldRegistryEntry>;
  previewRow: FormulaPreviewRowSnapshot | null;
  previewStale: boolean;
  disabled?: boolean;
  onDraftChange: (draft: FormulaDraftState) => void;
};

export function FieldConfigSectionFormula({
  fieldId,
  initialSource,
  fieldRegistry,
  previewRow,
  previewStale,
  disabled = false,
  onDraftChange,
}: FieldConfigSectionFormulaProps) {
  const [source, setSource] = useStateFromInitial(initialSource);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const sourceInputId = useId();
  const previewLabelId = useId();

  const localState = useMemo<LocalFormulaState>(
    () => parseFormulaSource(source, fieldRegistry, { excludeSelfRefId: fieldId }),
    [source, fieldRegistry, fieldId],
  );
  const localErrorMessage = useMemo(() => formatLocalFormulaError(localState), [localState]);
  const dirty = source !== initialSource;
  const valid = !dirty || localState.kind === "ok";

  useEffect(() => {
    onDraftChange({ source, dirty, valid });
  }, [dirty, onDraftChange, source, valid]);

  const previewResult = useMemo<EvalResult | null>(() => {
    if (localState.kind !== "ok") return null;
    if (previewRow === null) return null;
    const accessor = (refFieldId: string): unknown => previewRow.values[refFieldId] ?? null;
    return evaluate(localState.ast, accessor, { fuse: createFuse() });
  }, [localState, previewRow]);

  const pendingCaretFrameRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pendingCaretFrameRef.current !== null) {
        cancelAnimationFrame(pendingCaretFrameRef.current);
      }
    },
    [],
  );

  const handleInsertToken = useCallback(
    (token: string) => {
      const el = inputRef.current;
      if (!el) {
        setSource((prev) =>
          prev.length + token.length > SOURCE_LENGTH_MAX ? prev : `${prev}${token}`,
        );
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
    },
    [setSource],
  );

  const handleSourceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && event.currentTarget.tagName === "INPUT") {
        event.preventDefault();
      }
    },
    [],
  );

  const paletteEntries = useMemo(
    () => fieldRegistry.filter((entry) => entry.field_id !== fieldId),
    [fieldRegistry, fieldId],
  );

  const useTextarea = source.length >= FORMULA_TEXTAREA_THRESHOLD;
  const escalateToModal = source.length >= FORMULA_MODAL_THRESHOLD;
  const sharedInputProps = {
    id: sourceInputId,
    ref: (node: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = node;
    },
    value: source,
    maxLength: SOURCE_LENGTH_MAX,
    spellCheck: false,
    autoComplete: "off",
    disabled,
    "aria-invalid": localErrorMessage && dirty ? true : undefined,
    "aria-describedby": previewLabelId,
    onChange: (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) =>
      setSource(event.target.value),
    onKeyDown: handleSourceKeyDown,
  } as const;

  return (
    <div
      className={joinClassNames(
        "data-table-field-config-modal-section",
        "data-table-formula-editor",
        escalateToModal && "data-table-formula-editor-modal",
      )}
      role="group"
      aria-label="Formula"
    >
      <label className="data-table-field-config-label" htmlFor={sourceInputId}>
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
        disabled={disabled || source.length >= SOURCE_LENGTH_MAX}
        onInsert={handleInsertToken}
      />

      <FormulaPreviewPanel
        labelId={previewLabelId}
        localState={localState}
        localErrorMessage={dirty ? localErrorMessage : null}
        previewRow={previewRow}
        previewStale={previewStale}
        previewResult={previewResult}
      />
    </div>
  );
}

function useStateFromInitial(initialSource: string): [string, Dispatch<SetStateAction<string>>] {
  const [source, setSource] = useState(initialSource);
  useEffect(() => {
    setSource(initialSource);
  }, [initialSource]);
  return [source, setSource];
}

type FormulaPreviewPanelProps = {
  labelId: string;
  localState: LocalFormulaState;
  localErrorMessage: string | null;
  previewRow: FormulaPreviewRowSnapshot | null;
  previewStale: boolean;
  previewResult: EvalResult | null;
};

function FormulaPreviewPanel({
  labelId,
  localState,
  localErrorMessage,
  previewRow,
  previewStale,
  previewResult,
}: FormulaPreviewPanelProps) {
  const panel = previewPanelContent(localState, localErrorMessage, previewRow, previewResult);
  return (
    <div
      id={labelId}
      className={joinClassNames("data-table-formula-editor-preview", panel.modifier)}
      role="status"
      aria-live="polite"
    >
      {previewRow ? (
        <span className="data-table-formula-editor-preview-label">
          Preview based on row at modal open{previewStale ? " — stale" : ""}
        </span>
      ) : null}
      {panel.body}
    </div>
  );
}

type PreviewPanel = { modifier: string | null; body: ReactNode };

function previewPanelContent(
  localState: LocalFormulaState,
  localErrorMessage: string | null,
  previewRow: FormulaPreviewRowSnapshot | null,
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
  if (previewRow === null) {
    return { modifier: null, body: "Focus a row to preview." };
  }
  if (previewResult === null) {
    return { modifier: null, body: null };
  }
  if (!previewResult.ok) {
    return {
      modifier: "data-table-formula-editor-preview-error",
      body: (
        <span className="data-table-formula-editor-preview-value">
          #ERROR - {COMPUTED_ERROR_MESSAGES[previewResult.code]}
        </span>
      ),
    };
  }
  return {
    modifier: null,
    body: (
      <span className="data-table-formula-editor-preview-value">
        {formatPreviewValue(previewResult.value)}
      </span>
    ),
  };
}

function formatPreviewValue(value: string | number | boolean | null): string {
  if (value === null) return "(blank)";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return value;
}

function joinClassNames(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
