import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactEventHandler,
  type UIEventHandler,
} from "react";
import { highlightFormulaSource, type FormulaHighlightSpan } from "../lib/formula/highlight";

export type FormulaSourceEditorProps = {
  id: string;
  value: string;
  maxLength: number;
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaActiveDescendant?: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onSelect?: ReactEventHandler<HTMLTextAreaElement>;
  onClick?: MouseEventHandler<HTMLTextAreaElement>;
};

export const FormulaSourceEditor = forwardRef<HTMLTextAreaElement, FormulaSourceEditorProps>(
  function FormulaSourceEditor(
    {
      id,
      value,
      maxLength,
      disabled = false,
      ariaInvalid,
      ariaDescribedBy,
      ariaControls,
      ariaExpanded,
      ariaActiveDescendant,
      onChange,
      onKeyDown,
      onSelect,
      onClick,
    },
    ref,
  ) {
    const spans = useMemo(() => highlightFormulaSource(value), [value]);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [scrollOffset, setScrollOffset] = useState({ left: 0, top: 0 });
    useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement, []);

    const handleScroll: UIEventHandler<HTMLTextAreaElement> = (event) => {
      setScrollOffset({
        left: event.currentTarget.scrollLeft,
        top: event.currentTarget.scrollTop,
      });
    };

    return (
      <div className="formula-source-editor" data-disabled={disabled ? "true" : undefined}>
        <pre
          className="formula-source-editor-highlight"
          aria-hidden="true"
          style={{
            transform: `translate(${-scrollOffset.left}px, ${-scrollOffset.top}px)`,
          }}
        >
          {spans.length > 0
            ? spans.map((span) => <FormulaHighlightToken key={span.start} span={span} />)
            : "\u00a0"}
        </pre>
        <textarea
          ref={textareaRef}
          id={id}
          className="data-table-add-field-textarea data-table-formula-editor-source formula-source-editor-input"
          value={value}
          maxLength={maxLength}
          rows={6}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          aria-autocomplete="list"
          aria-controls={ariaControls}
          aria-expanded={ariaExpanded}
          aria-activedescendant={ariaActiveDescendant}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onSelect={onSelect}
          onClick={onClick}
          onScroll={handleScroll}
        />
      </div>
    );
  },
);

function FormulaHighlightToken({ span }: { span: FormulaHighlightSpan }) {
  return (
    <span
      className={`formula-source-editor-token formula-source-editor-token-${span.kind}`}
      data-token-kind={span.kind}
    >
      {span.text}
    </span>
  );
}
