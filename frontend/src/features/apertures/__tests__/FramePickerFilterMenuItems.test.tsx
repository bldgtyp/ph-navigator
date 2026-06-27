import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppMenu } from "../../../shared/ui/AppMenu";
import { FramePickerFilterMenuItems } from "../components/FramePickerFilterMenuItems";
import {
  FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY,
  useFramePickerFilterPreferences,
} from "../hooks/useFramePickerFilterPreferences";

function Harness({ projectId = "project-1" }: { projectId?: string }) {
  const preferences = useFramePickerFilterPreferences(projectId);
  return (
    <AppMenu label="Aperture actions" defaultOpen>
      <FramePickerFilterMenuItems {...preferences} />
    </AppMenu>
  );
}

describe("FramePickerFilterMenuItems", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the default side-on and operation-off checkbox states", () => {
    render(<Harness />);

    expect(screen.getByRole("menuitemcheckbox", { name: "Filter frames by side" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Filter frames by operation" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("keeps the actions menu open and persists toggles under the project id", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Filter frames by side" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Filter frames by operation" }));

    expect(screen.getByRole("menuitemcheckbox", { name: "Filter frames by side" })).toBeVisible();
    expect(screen.getByRole("menuitemcheckbox", { name: "Filter frames by side" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Filter frames by operation" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      JSON.parse(window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY)!),
    ).toEqual({
      "project-1": {
        filterFramesBySide: false,
        filterFramesByOperation: true,
      },
    });
  });
});
