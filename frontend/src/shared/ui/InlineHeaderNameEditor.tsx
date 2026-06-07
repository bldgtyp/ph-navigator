import { Check, Pencil, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type MouseEvent,
} from "react";

export function InlineHeaderNameEditor({
  value,
  fallbackValue,
  variant = "heading",
  className: extraClassName,
  canEdit,
  busy,
  editLabel,
  inputLabel,
  getValidationMessage,
  showEditButton = true,
  editing,
  onEditingChange,
  onSubmit,
}: {
  value: string;
  fallbackValue?: string;
  variant?: "heading" | "inline";
  className?: string;
  canEdit: boolean;
  busy: boolean;
  editLabel: string;
  inputLabel: string;
  getValidationMessage?: (value: string) => string | null;
  showEditButton?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onSubmit: (value: string) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const isEditing = editing ?? internalEditing;
  const trimmed = draft.trim();
  const unchanged = trimmed === value.trim();
  const validationMessage = getValidationMessage?.(trimmed) ?? null;
  const isInvalid = trimmed.length === 0 || unchanged || Boolean(validationMessage);
  const label = value || fallbackValue || "";
  const className = [
    "inline-header-name-editor",
    variant === "inline" ? "inline-header-name-editor--inline" : "",
    extraClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  function setEditing(next: boolean): void {
    if (editing === undefined) setInternalEditing(next);
    onEditingChange?.(next);
  }

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [isEditing, value]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isInvalid || busy) return;
    onSubmit(trimmed);
    setEditing(false);
  }

  function stopRowSelection(event: MouseEvent<HTMLElement>): void {
    event.stopPropagation();
  }

  function cancelEdit(): void {
    setDraft(value);
    setEditing(false);
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>): void {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    cancelEdit();
  }

  if (isEditing && canEdit) {
    return (
      <form
        className={`${className} is-editing`}
        onClick={stopRowSelection}
        onMouseDown={stopRowSelection}
        onBlur={handleBlur}
        onSubmit={submit}
      >
        <label className="sr-only" htmlFor={inputId}>
          {inputLabel}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            cancelEdit();
          }}
        />
        <button
          type="submit"
          className="inline-header-name-editor__button"
          aria-label="Save name"
          disabled={isInvalid || busy}
        >
          <Check size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="inline-header-name-editor__button"
          aria-label="Cancel name edit"
          disabled={busy}
          onClick={cancelEdit}
        >
          <X size={16} aria-hidden="true" />
        </button>
        {validationMessage ? (
          <span className="inline-header-name-editor__validation" role="alert">
            {validationMessage}
          </span>
        ) : null}
      </form>
    );
  }

  const LabelElement = variant === "inline" ? "span" : "h2";

  return (
    <LabelElement className={className}>
      <span>{label}</span>
      {canEdit && showEditButton ? (
        <button
          type="button"
          className="inline-header-name-editor__edit"
          aria-label={editLabel}
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
      ) : null}
    </LabelElement>
  );
}
