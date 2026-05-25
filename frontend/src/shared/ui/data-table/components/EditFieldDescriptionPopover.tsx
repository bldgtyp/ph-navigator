import * as Popover from "@radix-ui/react-popover";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MAX_DESCRIPTION } from "../lib/customFieldMutations";
import { useElementAnchorRef } from "../lib/popoverAnchor";
import { schemaMutationErrorMessage } from "../lib/schemaMutationErrors";

export type EditCustomFieldDescriptionRequest = {
  fieldKey: string;
  description: string | null;
};

export type EditFieldDescriptionPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  fieldKey: string;
  fieldDisplayName: string;
  initialDescription: string | null | undefined;
  dispatchDescription: (request: EditCustomFieldDescriptionRequest) => Promise<void>;
};

export function EditFieldDescriptionPopover({
  open,
  onOpenChange,
  anchorElement,
  fieldKey,
  fieldDisplayName,
  initialDescription,
  dispatchDescription,
}: EditFieldDescriptionPopoverProps) {
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaId = useId();

  useEffect(() => {
    if (!open) return;
    setDescription(initialDescription ?? "");
    setSubmitError(null);
    setPending(false);
  }, [initialDescription, open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  const trimmed = description.trim();
  const initialTrimmed = (initialDescription ?? "").trim();
  const request = useMemo<EditCustomFieldDescriptionRequest>(
    () => ({ fieldKey, description: trimmed ? trimmed : null }),
    [fieldKey, trimmed],
  );

  const submitCurrent = async () => {
    if (pending) return;
    if (trimmed === initialTrimmed) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    setSubmitError(null);
    try {
      await dispatchDescription(request);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(schemaMutationErrorMessage(error, "Could not update field description."));
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitCurrent();
  };

  const handleDescriptionInput = (event: FormEvent<HTMLTextAreaElement>) => {
    setDescription(event.currentTarget.value.slice(0, MAX_DESCRIPTION));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  const virtualAnchorRef = useElementAnchorRef(anchorElement);

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {virtualAnchorRef ? <Popover.Anchor virtualRef={virtualAnchorRef} /> : null}
      <Popover.Portal>
        <Popover.Content
          className="data-table-add-field-popover data-table-description-popover"
          side="bottom"
          align="start"
          sideOffset={6}
          role="dialog"
          aria-label={`Edit description for ${fieldDisplayName}`}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onKeyDown={handleKeyDown}
        >
          <form
            className="data-table-add-field-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <label className="data-table-add-field-label" htmlFor={textareaId}>
              Description
            </label>
            <textarea
              id={textareaId}
              ref={textareaRef}
              className="data-table-add-field-textarea"
              value={description}
              maxLength={MAX_DESCRIPTION}
              rows={4}
              onChange={handleDescriptionInput}
            />
            <span className="data-table-add-field-counter" aria-hidden>
              {description.trim().length}/{MAX_DESCRIPTION}
            </span>
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
              <button type="button" disabled={pending} onClick={() => void submitCurrent()}>
                {pending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
