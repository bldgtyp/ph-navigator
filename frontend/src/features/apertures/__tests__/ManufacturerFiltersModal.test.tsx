import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManufacturerFiltersModal } from "../components/ManufacturerFiltersModal";
import type { ApertureTypeEntry } from "../types";

const ROSTER_FRAME = {
  items: [
    { manufacturer: "Alpen", product_count: 3 },
    { manufacturer: "Schüco", product_count: 12 },
    { manufacturer: "Zola", product_count: 5 },
  ],
};

const ROSTER_GLAZING = {
  items: [
    { manufacturer: "Alpen", product_count: 2 },
    { manufacturer: "Internorm", product_count: 6 },
  ],
};

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response;
}

function fetchMockTwo() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/frame-types/manufacturers")) return jsonResponse(ROSTER_FRAME);
    if (url.includes("/glazing-types/manufacturers")) return jsonResponse(ROSTER_GLAZING);
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function renderModal(props: Partial<React.ComponentProps<typeof ManufacturerFiltersModal>> = {}) {
  const apertures: ApertureTypeEntry[] = props.apertures ?? [];
  const onSave = props.onSave ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <ManufacturerFiltersModal
          open={props.open ?? true}
          apertures={apertures}
          filters={props.filters ?? null}
          readOnly={props.readOnly}
          onSave={onSave}
          onClose={onClose}
        />
      </QueryClientProvider>,
    ),
    onSave,
    onClose,
  };
}

function checkboxFor(manufacturer: string): HTMLInputElement {
  const text = screen.getAllByText(manufacturer)[0];
  if (!text) throw new Error(`No row labelled ${manufacturer}`);
  const input = text.closest("label")?.querySelector("input[type='checkbox']");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`No checkbox for ${manufacturer}`);
  }
  return input;
}

describe("ManufacturerFiltersModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMockTwo());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders two columns with manufacturer rows and counts", async () => {
    renderModal();
    expect(await screen.findByRole("heading", { name: /Frame manufacturers/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Glazing manufacturers/i })).toBeTruthy();
    expect(screen.getByText("Schüco")).toBeTruthy();
    expect(screen.getByText("Internorm")).toBeTruthy();
  });

  it("Save is disabled until the user toggles something", async () => {
    renderModal();
    await screen.findByText("Schüco");
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.click(checkboxFor("Schüco"));
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it("Save dispatches the current draft", async () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    await screen.findByText("Schüco");
    fireEvent.click(checkboxFor("Schüco"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const next = onSave.mock.calls[0]?.[0] as {
      frame_manufacturers_enabled: string[] | null;
      glazing_manufacturers_enabled: string[] | null;
    };
    expect(next.frame_manufacturers_enabled).not.toBeNull();
    // Toggling Schüco off from the all-enabled default produces an
    // explicit list containing the other two roster entries.
    expect(next.frame_manufacturers_enabled).toEqual(expect.arrayContaining(["Alpen", "Zola"]));
    expect(next.frame_manufacturers_enabled).not.toEqual(expect.arrayContaining(["Schüco"]));
  });

  it("hides Save in read-only mode", async () => {
    renderModal({ readOnly: true });
    await screen.findByText("Schüco");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    const checkbox = checkboxFor("Schüco") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });
});
