import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnitPreferenceProvider } from "../../../lib/units";
import { ApertureSpecReportPanel } from "../components/ApertureSpecReportPanel";
import type { ApertureDriftEntry } from "../drift-types";
import type { ProjectGlazingRead } from "../types";

vi.mock("../../assets/hooks", () => ({
  useAssetUrls: () => ({ data: [], isPending: false }),
}));

function makeGlazing(overrides: Partial<ProjectGlazingRead>): ProjectGlazingRead {
  return {
    id: "glz_1",
    name: "Glazing A",
    manufacturer: "Alpen",
    brand: "Zenith",
    suffix: null,
    u_value_w_m2k: 0.72,
    g_value: 0.51,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
    datasheet_asset_ids: [],
    photo_asset_ids: [],
    specification_status: "needed",
    datasheet_not_required: false,
    photo_not_required: false,
    use_sites: [],
    ...overrides,
  };
}

describe("ApertureSpecReportPanel cross-aperture drift join", () => {
  it("joins drift entries by aperture_type_id so reused element IDs across aperture types never collide", () => {
    const onRefreshEntry = vi.fn();
    const entryA: ApertureDriftEntry = {
      aperture_type_id: "apt_1",
      aperture_type_name: "Window A",
      element_id: "el_shared",
      element_name: "Center",
      target: "glazing",
      kind: "field_delta",
      catalog_record_id: "rec_glz_a",
      deltas: [
        {
          field_key: "u_value_w_m2k",
          catalog_value: 0.6,
          yours_value: 0.7,
          in_local_overrides: false,
        },
      ],
    };
    const entryB: ApertureDriftEntry = {
      aperture_type_id: "apt_2",
      aperture_type_name: "Window B",
      element_id: "el_shared",
      element_name: "Center",
      target: "glazing",
      kind: "field_delta",
      catalog_record_id: "rec_glz_b",
      deltas: [
        {
          field_key: "g_value",
          catalog_value: 0.4,
          yours_value: 0.5,
          in_local_overrides: false,
        },
      ],
    };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <UnitPreferenceProvider>
          <ApertureSpecReportPanel
            rows={[
              makeGlazing({
                id: "glz_1",
                name: "Glazing A",
                use_sites: [
                  {
                    aperture_type_id: "apt_1",
                    aperture_type_name: "Window A",
                    element_id: "el_shared",
                    element_name: "Center",
                  },
                ],
              }),
              makeGlazing({
                id: "glz_2",
                name: "Glazing B",
                use_sites: [
                  {
                    aperture_type_id: "apt_2",
                    aperture_type_name: "Window B",
                    element_id: "el_shared",
                    element_name: "Center",
                  },
                ],
              }),
            ]}
            kind="glazing"
            productLabel="Glazings"
            productColumnLabel="Glazing"
            emptyMessage="Empty"
            projectId="project_1"
            isViewer={false}
            canEdit={true}
            busy={false}
            driftEntries={[entryA, entryB]}
            onCommand={vi.fn()}
            onCommandBatch={vi.fn()}
            onAttachmentChange={vi.fn()}
            onRefreshEntry={onRefreshEntry}
          />
        </UnitPreferenceProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("row", { name: /Glazing B/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review 1 catalog change" }));
    expect(onRefreshEntry).toHaveBeenCalledWith(entryB);
  });
});
