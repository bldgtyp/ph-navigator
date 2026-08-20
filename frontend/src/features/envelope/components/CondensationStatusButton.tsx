import type { AssemblyCondensationResponse } from "../condensation-types";
import { condensationChipPresentation } from "../condensation-chip";

export function CondensationStatusButton({
  result,
  loading,
  unavailable,
  onClick,
}: {
  result: AssemblyCondensationResponse | null;
  loading: boolean;
  unavailable: boolean;
  onClick: () => void;
}) {
  const presentation = condensationChipPresentation(result, loading, unavailable);
  return (
    <button
      type="button"
      className="link-button condensation-status-button"
      data-tone={presentation.tone}
      data-muted={presentation.muted || undefined}
      aria-label={presentation.label}
      onClick={onClick}
    >
      {presentation.label}
    </button>
  );
}
