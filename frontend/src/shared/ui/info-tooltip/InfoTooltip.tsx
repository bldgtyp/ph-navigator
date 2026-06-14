import { Info } from "lucide-react";
import type { ReactNode } from "react";

export type InfoTooltipProps = {
  /** Accessible label for the trigger button (its aria-label). */
  label: string;
  /**
   * Tooltip body. Revealed inside a `role="tooltip"` panel on hover/focus
   * of the trigger. Use `<strong>`/`<em>`/`<span>` for internal structure.
   */
  children: ReactNode;
  /** Optional id for the trigger button (e.g. a manual test selector). */
  id?: string;
};

/**
 * Small circular "ⓘ" trigger that reveals a multi-line explanatory panel on
 * hover/focus. Pure-CSS reveal — no JS state. Shared by the apertures
 * U-Value chip and the envelope assembly-thermal header, which previously
 * carried byte-identical copies of this markup + CSS (CSS rationalization
 * Phase 7). The panel styling lives in `InfoTooltip.css`, imported once via
 * `App.css`.
 */
export function InfoTooltip({ label, children, id }: InfoTooltipProps) {
  return (
    <button type="button" id={id} className="info-tooltip-button" aria-label={label}>
      <Info aria-hidden="true" size={12} strokeWidth={1.8} />
      <span className="info-tooltip-content" role="tooltip">
        {children}
      </span>
    </button>
  );
}
