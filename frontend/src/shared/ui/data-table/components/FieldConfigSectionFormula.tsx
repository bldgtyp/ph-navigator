import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
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
import {
  buildFormulaSuggestions,
  formulaSuggestionOptionId,
  getFormulaCaretContext,
  type FormulaSuggestion,
} from "../lib/formula/suggestions";
import { FormulaSourceEditor } from "./FormulaSourceEditor";
import { FormulaSuggestionPanel } from "./FormulaSuggestionPanel";

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
  onSuggestionPanelOpenChange?: (open: boolean) => void;
  dismissSuggestionsSignal?: number;
};

export function FieldConfigSectionFormula({
  fieldId,
  initialSource,
  fieldRegistry,
  previewRow,
  previewStale,
  disabled = false,
  onDraftChange,
  onSuggestionPanelOpenChange,
  dismissSuggestionsSignal,
}: FieldConfigSectionFormulaProps) {
  const [source, setSource] = useStateFromInitial(initialSource);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sourceInputId = useId();
  const previewLabelId = useId();
  const suggestionPanelId = useId();
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const lastDismissSuggestionsSignalRef = useRef(dismissSuggestionsSignal);

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

  const updateSelectionFromInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    setSelection({ start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 });
    setSuggestionsDismissed(false);
  }, []);

  const setSourceAndCaret = useCallback(
    (next: string, caret: number) => {
      setSource(next);
      setSelection({ start: caret, end: caret });
      setSuggestionsDismissed(false);
      if (pendingCaretFrameRef.current !== null) {
        cancelAnimationFrame(pendingCaretFrameRef.current);
      }
      pendingCaretFrameRef.current = requestAnimationFrame(() => {
        pendingCaretFrameRef.current = null;
        const updated = inputRef.current;
        if (!updated) return;
        updated.focus();
        updated.setSelectionRange(caret, caret);
      });
    },
    [setSource],
  );

  const handleInsertSuggestion = useCallback(
    (suggestion: FormulaSuggestion) => {
      const context = getFormulaCaretContext(source, selection.start, selection.end);
      if (context.mode === "none") return;
      const next = `${source.slice(0, context.range.start)}${suggestion.insertText}${source.slice(
        context.range.end,
      )}`;
      if (next.length > SOURCE_LENGTH_MAX) return;
      const caret = context.range.start + suggestion.insertText.length;
      setSourceAndCaret(next, caret);
    },
    [selection.end, selection.start, setSourceAndCaret, source],
  );

  const handleSourceChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.currentTarget.value;
      let start = event.currentTarget.selectionStart ?? 0;
      let end = event.currentTarget.selectionEnd ?? start;
      if (start === 0 && end === 0 && nextValue.length > 0 && nextValue !== source) {
        start = nextValue.length;
        end = nextValue.length;
      }
      setSource(nextValue);
      setSelection({
        start,
        end,
      });
      setSuggestionsDismissed(false);
    },
    [setSource, source],
  );

  const suggestionEntries = useMemo(
    () => fieldRegistry.filter((entry) => entry.field_id !== fieldId),
    [fieldRegistry, fieldId],
  );
  const suggestionContext = useMemo(
    () => getFormulaCaretContext(source, selection.start, selection.end),
    [selection.end, selection.start, source],
  );
  const suggestions = useMemo(
    () => buildFormulaSuggestions(suggestionContext, suggestionEntries),
    [suggestionContext, suggestionEntries],
  );
  const suggestionPanelOpen = !disabled && !suggestionsDismissed && suggestions.length > 0;

  useEffect(() => {
    onSuggestionPanelOpenChange?.(suggestionPanelOpen);
  }, [onSuggestionPanelOpenChange, suggestionPanelOpen]);

  useEffect(() => {
    if (dismissSuggestionsSignal === undefined) return;
    if (lastDismissSuggestionsSignalRef.current === dismissSuggestionsSignal) return;
    lastDismissSuggestionsSignalRef.current = dismissSuggestionsSignal;
    setSuggestionsDismissed(true);
  }, [dismissSuggestionsSignal]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [suggestionContext.query, suggestionContext.mode]);

  useEffect(() => {
    setActiveSuggestionIndex((index) => Math.min(index, Math.max(0, suggestions.length - 1)));
  }, [suggestions.length]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!suggestionPanelOpen) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const suggestion = suggestions[activeSuggestionIndex];
        if (suggestion) handleInsertSuggestion(suggestion);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSuggestionsDismissed(true);
      }
    },
    [activeSuggestionIndex, handleInsertSuggestion, suggestionPanelOpen, suggestions],
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
      <div className="formula-editor-composer">
        <FormulaSourceEditor
          ref={inputRef}
          id={sourceInputId}
          value={source}
          maxLength={SOURCE_LENGTH_MAX}
          disabled={disabled}
          ariaInvalid={Boolean(localMessage && dirty)}
          ariaDescribedBy={previewLabelId}
          ariaControls={suggestionPanelOpen ? suggestionPanelId : undefined}
          ariaExpanded={suggestionPanelOpen}
          ariaActiveDescendant={
            suggestionPanelOpen
              ? formulaSuggestionOptionId(suggestionPanelId, activeSuggestionIndex)
              : undefined
          }
          onChange={handleSourceChange}
          onKeyDown={handleKeyDown}
          onSelect={updateSelectionFromInput}
          onClick={updateSelectionFromInput}
        />
        {suggestionPanelOpen ? (
          <FormulaSuggestionPanel
            id={suggestionPanelId}
            suggestions={suggestions}
            activeIndex={activeSuggestionIndex}
            onActiveIndexChange={setActiveSuggestionIndex}
            onSelect={handleInsertSuggestion}
          />
        ) : null}
      </div>
      <span className="data-table-add-field-counter" aria-hidden>
        {source.length}/{SOURCE_LENGTH_MAX}
      </span>

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
