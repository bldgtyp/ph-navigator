import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import { useModelViewerPopoverEscape } from "../lib/events";
import { themeLabel, themesForLens } from "../lib/themeState";
import { useModelViewerStore } from "../store";
import type { ModelViewerLens, ModelViewerTheme } from "../types";

export function ThemeMenu({ lens, theme }: { lens: ModelViewerLens; theme: ModelViewerTheme }) {
  const [open, setOpen] = useState(false);
  const setTheme = useModelViewerStore((state) => state.setTheme);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const themes = themesForLens(lens);
  const close = useCallback(() => setOpen(false), []);
  useOutsidePointerDown(rootRef, open, close);
  useModelViewerPopoverEscape(close);

  return (
    <div className="model-theme-menu" ref={rootRef}>
      <button
        type="button"
        className="model-theme-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Color: ${themeLabel(theme)}`}
        title={`Color theme: ${themeLabel(theme)}`}
        onClick={() => setOpen((current) => !current)}
      >
        <Palette size={14} aria-hidden />
        <span>{themeLabel(theme)}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open ? (
        <div className="model-theme-menu-list" role="menu" aria-label="Color theme">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              className="model-theme-menu-option"
              role="menuitemcheckbox"
              aria-checked={theme === option.id}
              onClick={() => {
                setTheme(lens, option.id);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {theme === option.id ? <Check size={14} aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
