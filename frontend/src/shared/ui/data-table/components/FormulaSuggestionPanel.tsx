import { formulaSuggestionOptionId, type FormulaSuggestion } from "../lib/formula/suggestions";

export type FormulaSuggestionPanelProps = {
  id: string;
  suggestions: ReadonlyArray<FormulaSuggestion>;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (suggestion: FormulaSuggestion) => void;
};

export function FormulaSuggestionPanel({
  id,
  suggestions,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}: FormulaSuggestionPanelProps) {
  if (suggestions.length === 0) return null;
  return (
    <div className="formula-suggestion-panel" aria-label="Insert a field or function">
      <div className="formula-suggestion-panel-title">Insert a field or function</div>
      <ul id={id} className="formula-suggestion-list" role="listbox">
        {suggestions.map((suggestion, index) => {
          const selected = index === activeIndex;
          return (
            <li
              key={suggestion.id}
              id={formulaSuggestionOptionId(id, index)}
              className="formula-suggestion-option"
              data-kind={suggestion.kind}
              role="option"
              aria-selected={selected}
              onMouseEnter={() => onActiveIndexChange(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(suggestion)}
            >
              <span className="formula-suggestion-option-label">{suggestion.label}</span>
              <span className="formula-suggestion-option-detail">{suggestion.detail}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
