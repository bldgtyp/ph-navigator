import { useRef, useState } from "react";
import {
  Box,
  Building2,
  Check,
  ChevronDown,
  Droplets,
  Layers3,
  Palette,
  Sun,
  Wind,
} from "lucide-react";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import { disabledLensReason, MODEL_VIEWER_LENSES } from "../lib/lenses";
import { hasThemeMenu, themeLabel, themesForLens } from "../lib/themes";
import type { LensAvailability } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelViewerLens, ModelViewerTheme } from "../types";

type LensBarProps = {
  availability: LensAvailability | null;
};

export function LensBar({ availability }: LensBarProps) {
  const activeLens = useModelViewerStore((state) => state.lens);
  const activeTheme = useModelViewerStore((state) => state.themesByLens[state.lens]);
  const setLens = useModelViewerStore((state) => state.setLens);

  return (
    <div className="model-lens-bar" role="toolbar" aria-label="Model viewing lens">
      <div className="model-lens-segments">
        {MODEL_VIEWER_LENSES.map((lens) => {
          const disabledReason = disabledLensReason(lens.id, availability);
          const disabled = disabledReason !== null;
          const Icon = iconForLens(lens.id);
          return (
            <button
              key={lens.id}
              type="button"
              className={activeLens === lens.id ? "active" : undefined}
              disabled={disabled}
              title={disabledReason ?? lens.label}
              aria-pressed={activeLens === lens.id}
              onClick={() => {
                if (activeLens !== lens.id) setLens(lens.id);
              }}
            >
              <Icon size={15} aria-hidden />
              <span>{lens.label}</span>
            </button>
          );
        })}
      </div>
      {hasThemeMenu(activeLens) ? <ThemeMenu lens={activeLens} theme={activeTheme} /> : null}
    </div>
  );
}

function ThemeMenu({ lens, theme }: { lens: ModelViewerLens; theme: ModelViewerTheme }) {
  const [open, setOpen] = useState(false);
  const setTheme = useModelViewerStore((state) => state.setTheme);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const themes = themesForLens(lens);
  useOutsidePointerDown(rootRef, open, () => setOpen(false));

  return (
    <div className="model-theme-menu" ref={rootRef}>
      <button
        type="button"
        className="model-theme-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Palette size={14} aria-hidden />
        <span>Color: {themeLabel(theme)}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open ? (
        <div className="model-theme-menu-list" role="menu" aria-label="Color theme">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
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

function iconForLens(lens: ModelViewerLens) {
  switch (lens) {
    case "building":
      return Building2;
    case "spaces":
      return Box;
    case "floor-areas":
      return Layers3;
    case "site-sun":
      return Sun;
    case "ventilation":
      return Wind;
    case "hot-water":
      return Droplets;
  }
}
