import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import {
  COMPUTED_ERROR_MESSAGES,
  SOURCE_LENGTH_MAX,
  createFuse,
  evaluate,
  formatLocalFormulaMessage,
  parseFormulaSource,
  type EvalResult,
  type FieldRegistryEntry,
  type FormulaLocalMessage,
  type LocalFormulaState,
} from "../lib/formula";
import { FormulaFieldPalette } from "./FormulaFieldPalette";
import { FormulaSourceEditor } from "./FormulaSourceEditor";

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sourceInputId = useId();
  const previewLabelId = useId();

  const localState = useMemo<LocalFormulaState>(
    () => parseFormulaSource(source, fieldRegistry, { excludeSelfRefId: fieldId }),
    [source, fieldRegistry, fieldId],
  );
  const localMessage = useMemo(() => formatLocalFormulaMessage(localState), [localState]);
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

  const paletteEntries = useMemo(
    () => fieldRegistry.filter((entry) => entry.field_id !== fieldId),
    [fieldRegistry, fieldId],
  );

  return (
    <div
      className="data-table-field-config-modal-section data-table-formula-editor"
      role="group"
      aria-label="Formula"
    >
      <label className="data-table-field-config-label" htmlFor={sourceInputId}>
        Expression
      </label>
      <FormulaSourceEditor
        ref={inputRef}
        id={sourceInputId}
        value={source}
        maxLength={SOURCE_LENGTH_MAX}
        disabled={disabled}
        ariaInvalid={Boolean(localMessage && dirty)}
        ariaDescribedBy={previewLabelId}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setSource(event.target.value)}
      />
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
        localMessage={dirty ? localMessage : null}
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
  localMessage: FormulaLocalMessage | null;
  previewRow: FormulaPreviewRowSnapshot | null;
  previewStale: boolean;
  previewResult: EvalResult | null;
};

function FormulaPreviewPanel({
  labelId,
  localState,
  localMessage,
  previewRow,
  previewStale,
  previewResult,
}: FormulaPreviewPanelProps) {
  const panel = previewPanelContent(
    localState,
    localMessage,
    previewRow,
    previewStale,
    previewResult,
  );
  return (
    <div
      id={labelId}
      className={joinClassNames(
        "data-table-formula-editor-preview",
        `data-table-formula-editor-preview-${panel.tone}`,
      )}
      role={panel.role}
      aria-live={panel.role === "alert" ? "assertive" : "polite"}
    >
      <span className="data-table-formula-editor-preview-title">{panel.title}</span>
      <span className="data-table-formula-editor-preview-body">{panel.body}</span>
      {panel.detail ? (
        <span className="data-table-formula-editor-preview-detail">{panel.detail}</span>
      ) : null}
    </div>
  );
}

type PreviewPanel = {
  tone: "neutral" | "empty" | "error";
  role: "status" | "alert";
  title: string;
  body: ReactNode;
  detail?: ReactNode;
};

function previewPanelContent(
  localState: LocalFormulaState,
  localMessage: FormulaLocalMessage | null,
  previewRow: FormulaPreviewRowSnapshot | null,
  previewStale: boolean,
  previewResult: EvalResult | null,
): PreviewPanel {
  if (localMessage) {
    return {
      tone: "error",
      role: "alert",
      title: localMessage.title,
      body: localMessage.body,
      detail: localMessage.detail,
    };
  }
  if (localState.kind === "empty") {
    return {
      tone: "empty",
      role: "status",
      title: "Formula preview",
      body: "Enter an expression to preview.",
    };
  }
  if (previewRow === null) {
    return {
      tone: "neutral",
      role: "status",
      title: "Formula preview",
      body: "Focus a row to preview.",
    };
  }
  if (previewResult === null) {
    return {
      tone: "neutral",
      role: "status",
      title: previewTitle(previewStale),
      body: "Preview unavailable.",
    };
  }
  if (!previewResult.ok) {
    return {
      tone: "error",
      role: "alert",
      title: "Formula result error",
      body: (
        <span className="data-table-formula-editor-preview-value">
          #ERROR - {COMPUTED_ERROR_MESSAGES[previewResult.code]}
        </span>
      ),
      detail: previewTitle(previewStale),
    };
  }
  return {
    tone: "neutral",
    role: "status",
    title: previewTitle(previewStale),
    body: (
      <span className="data-table-formula-editor-preview-value">
        {formatPreviewValue(previewResult.value)}
      </span>
    ),
  };
}

function previewTitle(previewStale: boolean): string {
  return `Preview based on row at modal open${previewStale ? " — stale" : ""}`;
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
