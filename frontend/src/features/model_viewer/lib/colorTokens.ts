export const VIEWER_HIGHLIGHT_FALLBACK = "#E23489";
export const VIEWER_FACE_EDGE_COLOR = "#a8a6a1";
export const VIEWER_GHOST_EDGE_COLOR = "#6d736f";
/** Lighter edge color while a legend filter isolates faces: the kept-but-hidden
 *  faces read as a faint wireframe context behind the solid matched bucket. */
export const VIEWER_FILTER_WIREFRAME_COLOR = "#cdc8bf";
/** Faint color for a line object dimmed out by a legend filter (line lenses have
 *  no faces/edges, so the line itself is dimmed rather than hidden). */
export const VIEWER_FILTER_DIM_LINE_COLOR = "#bdb8af";
export const VIEWER_LINE_HOVER_COLOR = "#f0a8cb";
export const VIEWER_DUCT_SUPPLY_COLOR = "#2674d9";
export const VIEWER_DUCT_EXHAUST_COLOR = "#d94a3a";
export const VIEWER_PIPE_DISTRIBUTION_COLOR = "#9a4f1f";
export const VIEWER_PIPE_RECIRC_COLOR = "#d4952f";
export const VIEWER_SHADE_COLOR = "#a8aca7";
export const VIEWER_SHADE_EDGE_COLOR = "#7d837d";
export const VIEWER_SITE_COMPASS_COLOR = "#5f6760";
export const VIEWER_SUN_PATH_COLOR = VIEWER_HIGHLIGHT_FALLBACK;
/** Soft-lighting hemisphere dome (rendering-style refactor): a near-white sky
 *  and a warm-grey ground bounce, for the matte "study model" look. */
export const VIEWER_SOFT_SKY_COLOR = "#fcfcfc";
export const VIEWER_SOFT_GROUND_COLOR = "#d6d6d6";
/** Light near-white neutral backdrop under soft lighting (vs the warm "snow"
 *  default). Kept close to white + de-saturated so it doesn't read as a dark
 *  blue-grey; lit faces still pop because the strong key clips them brighter. */
export const VIEWER_SOFT_BG_COLOR = "#f5f5f6";
