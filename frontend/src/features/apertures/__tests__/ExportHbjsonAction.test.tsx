import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportHbjsonAction, suggestedFilename } from "../components/ExportHbjsonAction";

describe("suggestedFilename", () => {
  it("slugs bt number and version label", () => {
    expect(suggestedFilename("BT-01", "Schematic Design")).toBe(
      "BT-01_Schematic_Design_apertures.hbjson.json",
    );
  });

  it("falls back to defaults for empty inputs", () => {
    expect(suggestedFilename("", "")).toBe("project_version_apertures.hbjson.json");
  });
});

describe("ExportHbjsonAction", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue("blob:test");
    URL.revokeObjectURL = vi.fn();
    // jsdom logs "navigation not implemented" when an <a download> is clicked.
    // Stub click() so the download path runs cleanly under the test.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it("calls the export endpoint and triggers a download on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Door_A_C0_R0: { type: "WindowConstruction" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ExportHbjsonAction
        projectId="p1"
        versionId="v1"
        source="draft"
        projectBtNumber="BT-01"
        versionLabel="Draft"
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const firstCall = fetchMock.mock.calls[0] ?? [];
    expect(String(firstCall[0])).toContain("/apertures/hbjson?source=draft");
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  });

  it("surfaces a collision error through onError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({
        error_code: "aperture_hbjson_identifier_collision",
        message: "collision",
        request_id: "r1",
        details: { collisions: [{ first: "Door A", second: "Door-A", escaped: "Door_A_C0_R0" }] },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onError = vi.fn();
    render(
      <ExportHbjsonAction
        projectId="p1"
        versionId="v1"
        source="draft"
        projectBtNumber="BT-01"
        versionLabel="Draft"
        onError={onError}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const message = (onError.mock.calls[0] ?? [""])[0] as string;
    expect(message).toContain("Door A");
    expect(message).toContain("Door-A");
  });

  it("is disabled when the disabled prop is set", () => {
    render(
      <ExportHbjsonAction
        projectId="p1"
        versionId="v1"
        source="draft"
        projectBtNumber="BT-01"
        versionLabel="Draft"
        disabled
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
