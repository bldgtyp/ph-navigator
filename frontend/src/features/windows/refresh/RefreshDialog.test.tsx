import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { FrameRef } from "../types";
import { RefreshDialog } from "./RefreshDialog";
import type { RefreshSlotReport } from "./types";

const frameRef: FrameRef = {
  name: "Old frame",
  manufacturer: "Skyline",
  brand: "SR",
  use: null,
  operation: null,
  location: null,
  mull_type: null,
  prefix: null,
  suffix: null,
  material: null,
  width_mm: 80,
  u_value_w_m2k: 0.85,
  psi_g_w_mk: 0.04,
  psi_install_w_mk: 0.05,
  color: null,
  source: null,
  comments: null,
  catalog_origin: {
    catalog_table: "frame_types",
    catalog_record_id: "rec1234567890ab",
    catalog_version_id: null,
    catalog_schema_version: null,
    synced_at: "2026-05-14T00:00:00.000Z",
    local_overrides: [],
  },
};

const slot: RefreshSlotReport = {
  window_type_id: "win_1",
  element_id: "winel_1",
  slot: "frame.top",
  state: "drifted",
  catalog_table: "frame_types",
  catalog_record_id: "rec1234567890ab",
  pinned_catalog_version_id: "framev_old",
  current_catalog_version_id: "framev_new",
  local_overrides: [],
  fields: [
    {
      key: "name",
      ref_value: "Old frame",
      catalog_value: "New frame",
      is_overridden: false,
      skip_reason: "field_type_changed",
    },
    {
      key: "brand",
      ref_value: "SR",
      catalog_value: "SRX",
      is_overridden: false,
    },
  ],
};

describe("RefreshDialog", () => {
  test("renders field-type mismatches as skipped rows", () => {
    render(
      <RefreshDialog
        slot={slot}
        refValue={frameRef}
        busy={false}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Review catalog refresh" });
    expect(within(dialog).getByText("Skipped")).toBeVisible();
    expect(
      within(dialog).getByText(
        "Skipped because this project field's type no longer matches the catalog.",
      ),
    ).toBeVisible();

    const skippedRow = within(dialog).getByText("name").closest("fieldset");
    expect(skippedRow).not.toBeNull();
    const skippedControls = within(skippedRow!).getAllByRole("radio");
    expect(skippedControls).toHaveLength(2);
    skippedControls.forEach((control) => expect(control).toBeDisabled());

    const updateableRow = within(dialog).getByText("brand").closest("fieldset");
    expect(updateableRow).not.toBeNull();
    expect(within(updateableRow!).getByLabelText("Update from catalog")).not.toBeDisabled();
  });
});
