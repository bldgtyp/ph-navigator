import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "../tooltip";

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
 * hover/focus. Shared by the apertures U-Value chip, the envelope
 * assembly-thermal header and the status vocabulary.
 *
 * The panel is the shared {@link Tooltip} bubble — i.e. portalled — because the
 * ⓘ sits inside chips and headers whose ancestors scroll or clip: an
 * absolutely-positioned panel (what this used to be) is cut off by the first
 * `overflow` ancestor, which is exactly what happened to the U-Value chip on
 * the Apertures page. `InfoTooltip.css` now styles only the trigger and the
 * content stack; the bubble's chrome comes from the one tooltip owner.
 */
export function InfoTooltip({ label, children, id }: InfoTooltipProps) {
  return (
    <Tooltip content={<span className="info-tooltip-content">{children}</span>} placement="bottom">
      <button type="button" id={id} className="info-tooltip-button" aria-label={label}>
        <Info aria-hidden="true" size={12} strokeWidth={1.8} />
      </button>
    </Tooltip>
  );
}
