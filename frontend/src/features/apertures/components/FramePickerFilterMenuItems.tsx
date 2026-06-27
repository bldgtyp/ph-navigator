import { AppMenuCheckboxItem } from "../../../shared/ui/AppMenu";
import type { FramePickerFilterPreferencesState } from "../hooks/useFramePickerFilterPreferences";

const SIDE_FILTER_TOOLTIP =
  "Show Head frames for top, Jamb frames for left/right, and Sill frames for bottom. Any-location frames stay visible.";

const OPERATION_FILTER_TOOLTIP =
  "Show frames matching the element operation family. Existing frame assignments are not cleared.";

type Props = Pick<
  FramePickerFilterPreferencesState,
  | "filterFramesBySide"
  | "filterFramesByOperation"
  | "setFilterFramesBySide"
  | "setFilterFramesByOperation"
>;

export function FramePickerFilterMenuItems({
  filterFramesBySide,
  filterFramesByOperation,
  setFilterFramesBySide,
  setFilterFramesByOperation,
}: Props) {
  return (
    <>
      <AppMenuCheckboxItem
        checked={filterFramesBySide}
        title={SIDE_FILTER_TOOLTIP}
        aria-description={SIDE_FILTER_TOOLTIP}
        data-tooltip={SIDE_FILTER_TOOLTIP}
        onClick={() => setFilterFramesBySide(!filterFramesBySide)}
      >
        Filter frames by side
      </AppMenuCheckboxItem>
      <AppMenuCheckboxItem
        checked={filterFramesByOperation}
        title={OPERATION_FILTER_TOOLTIP}
        aria-description={OPERATION_FILTER_TOOLTIP}
        data-tooltip={OPERATION_FILTER_TOOLTIP}
        onClick={() => setFilterFramesByOperation(!filterFramesByOperation)}
      >
        Filter frames by operation
      </AppMenuCheckboxItem>
    </>
  );
}
