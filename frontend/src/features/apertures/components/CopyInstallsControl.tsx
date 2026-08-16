// Installs-modal header action: copy this aperture's edge assignments onto
// other apertures whose grid signature matches. The candidate list is computed
// by the modal, and the chosen targets are staged there (written on Save like
// every other edit in the dialog); this component owns the popover only.
import { useRef, useState } from "react";
import { Tooltip } from "../../../shared/ui/tooltip";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import type { ApertureTypeEntry } from "../types";

export function CopyInstallsControl({
  aperture,
  candidates,
  canEdit,
  busy,
  staged,
  onStage,
}: {
  aperture: ApertureTypeEntry;
  candidates: readonly ApertureTypeEntry[];
  canEdit: boolean;
  busy: boolean;
  staged: readonly string[];
  onStage: (targetIds: string[]) => void;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<ReadonlySet<string>>(new Set(staged));
  useOutsidePointerDown(rootRef, open, () => setOpen(false));

  return (
    <span ref={rootRef} className="installs-modal__copy">
      {/* The disabled case is the one that needs explaining, so the tooltip
          hangs off the wrapper (a disabled button fires no pointer events) and
          says why there is nothing to copy to. */}
      <Tooltip
        content={
          candidates.length === 0
            ? "Nothing to copy to: this would replace another aperture's edge assignments with this one's, and no other aperture in the project has an identical grid (same rows, columns and element layout)."
            : `Replace the edge assignments of ${candidates.length} identical-grid ${
                candidates.length === 1 ? "aperture" : "apertures"
              } with ${aperture.name}'s.`
        }
        placement="bottom"
      >
        <span className="installs-modal__tooltip-anchor">
          <button
            type="button"
            className="secondary-button"
            disabled={!canEdit || candidates.length === 0 || busy}
            aria-expanded={open}
            aria-haspopup="true"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
          >
            Copy to other apertures…
          </button>
        </span>
      </Tooltip>
      {open ? (
        <div className="installs-modal__copy-popover" role="group" aria-label="Copy targets">
          {/* The action is easy to misread from its label alone, so the popover
              states both what moves (this aperture's edge assignments) and that
              the target's own assignments are overwritten. */}
          <p className="installs-modal__copy-lede">
            Each selected aperture's edge assignments are replaced with this one's when you save.
            Only apertures with an identical grid can be targets.
          </p>
          {candidates.map((candidate) => (
            <label key={candidate.id} className="installs-modal__copy-option">
              <input
                type="checkbox"
                checked={targets.has(candidate.id)}
                onChange={(event) => {
                  const next = new Set(targets);
                  if (event.target.checked) next.add(candidate.id);
                  else next.delete(candidate.id);
                  setTargets(next);
                }}
              />
              {candidate.name}
            </label>
          ))}
          <div className="installs-modal__copy-actions">
            <button
              type="button"
              className="primary-button"
              disabled={targets.size === 0 || busy}
              onClick={() => {
                onStage([...targets]);
                setOpen(false);
              }}
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
