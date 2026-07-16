import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import { LOCATION_PROJECT as PROJECT, jsonResponse } from "../../testing/locationFixtures";
import type { ProjectDetail } from "../../types";
import { ProjectSettingsModal } from "../ProjectSettingsModal";

const fetchMock = vi.fn();

function renderModal(project: ProjectDetail = PROJECT, onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceContext.Provider
        value={{
          unitSystem: "SI",
          source: "default",
          error: null,
          setUnitSystem: vi.fn(),
          toggleUnitSystem: vi.fn(),
        }}
      >
        <ProjectSettingsModal project={project} onClose={onClose} />
      </UnitPreferenceContext.Provider>
    </QueryClientProvider>,
  );
  return { onClose };
}

function stubFetch(patchCapture?: (body: unknown) => void) {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === `/api/v1/projects/${PROJECT.id}` && init?.method === "PATCH") {
      patchCapture?.(JSON.parse(String(init.body)));
      return jsonResponse({ ...PROJECT, public_alias: "Manhattan Townhouse" });
    }
    if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse({}, 404);
    if (url === `/api/v1/projects/${PROJECT.id}/mcp-tokens`) return jsonResponse({ tokens: [] });
    return jsonResponse({}, 404);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("ProjectSettingsModal public alias", () => {
  test("renders the alias field seeded from the project", () => {
    stubFetch();
    renderModal({ ...PROJECT, public_alias: "Manhattan Townhouse" });
    expect(screen.getByLabelText("Public alias")).toHaveValue("Manhattan Townhouse");
  });

  test("editing the alias sends public_alias in the update payload", async () => {
    const bodies: unknown[] = [];
    stubFetch((body) => bodies.push(body));
    const { onClose } = renderModal();

    await userEvent.type(screen.getByLabelText("Public alias"), "Manhattan Townhouse");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toContainEqual({ public_alias: "Manhattan Townhouse" });
  });

  test("clearing the alias sends public_alias: null", async () => {
    const bodies: unknown[] = [];
    stubFetch((body) => bodies.push(body));
    const { onClose } = renderModal({ ...PROJECT, public_alias: "Manhattan Townhouse" });

    await userEvent.clear(screen.getByLabelText("Public alias"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toContainEqual({ public_alias: null });
  });
});
