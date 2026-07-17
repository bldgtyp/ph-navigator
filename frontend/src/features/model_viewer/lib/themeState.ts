import type { ModelViewerLens, ModelViewerTheme } from "../types";

type ThemeDefinition = {
  id: ModelViewerTheme;
  label: string;
};

export const MODEL_VIEWER_THEMES_BY_LENS: Record<ModelViewerLens, ThemeDefinition[]> = {
  building: [
    { id: "shaded", label: "Shaded" },
    { id: "surface-type", label: "Surface Type" },
    { id: "boundary", label: "Boundary" },
    { id: "construction", label: "Construction" },
    { id: "window-construction", label: "Window Construction" },
  ],
  spaces: [
    { id: "shaded", label: "Shaded" },
    { id: "ventilation-airflow", label: "Ventilation Airflow" },
    { id: "ventilation-unit", label: "Ventilation Unit" },
  ],
  "floor-areas": [
    { id: "weighting-factor", label: "Weighting Factor" },
    { id: "shaded", label: "Shaded" },
    { id: "ventilation-airflow", label: "Ventilation Airflow" },
    { id: "ventilation-unit", label: "Ventilation Unit" },
  ],
  "site-sun": [{ id: "shaded", label: "Shaded" }],
  ventilation: [{ id: "shaded", label: "Shaded" }],
  "hot-water": [{ id: "shaded", label: "Shaded" }],
};

export const DEFAULT_MODEL_VIEWER_THEMES: Record<ModelViewerLens, ModelViewerTheme> = {
  building: "shaded",
  spaces: "shaded",
  "floor-areas": "weighting-factor",
  "site-sun": "shaded",
  ventilation: "shaded",
  "hot-water": "shaded",
};

const ALL_MODEL_VIEWER_THEMES = Array.from(
  new Set(
    Object.values(MODEL_VIEWER_THEMES_BY_LENS)
      .flat()
      .map((theme) => theme.id),
  ),
);

export function themesForLens(lens: ModelViewerLens): ThemeDefinition[] {
  return MODEL_VIEWER_THEMES_BY_LENS[lens];
}

export function defaultThemeForLens(lens: ModelViewerLens): ModelViewerTheme {
  return DEFAULT_MODEL_VIEWER_THEMES[lens];
}

export function hasThemeMenu(lens: ModelViewerLens): boolean {
  return themesForLens(lens).length > 1;
}

export function themeLabel(theme: ModelViewerTheme): string {
  return (
    ALL_MODEL_VIEWER_THEMES.map((id) => findThemeDefinition(id)).find(
      (definition) => definition?.id === theme,
    )?.label ?? theme
  );
}

export function isThemeAllowedForLens(lens: ModelViewerLens, theme: ModelViewerTheme): boolean {
  return themesForLens(lens).some((definition) => definition.id === theme);
}

export function parseModelViewerTheme(
  lens: ModelViewerLens,
  value: string | null,
): ModelViewerTheme {
  if (!isModelViewerTheme(value)) return defaultThemeForLens(lens);
  return isThemeAllowedForLens(lens, value) ? value : defaultThemeForLens(lens);
}

function isModelViewerTheme(value: string | null): value is ModelViewerTheme {
  return value !== null && ALL_MODEL_VIEWER_THEMES.includes(value as ModelViewerTheme);
}

function findThemeDefinition(theme: ModelViewerTheme): ThemeDefinition | undefined {
  for (const definitions of Object.values(MODEL_VIEWER_THEMES_BY_LENS)) {
    const definition = definitions.find((candidate) => candidate.id === theme);
    if (definition) return definition;
  }
  return undefined;
}
