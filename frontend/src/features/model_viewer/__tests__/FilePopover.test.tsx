import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { FilePopover } from "../components/FilePopover";
import type { HbjsonUploadFlow } from "../hooks";
import type { HbjsonFile } from "../types";

function file(overrides: Partial<HbjsonFile>): HbjsonFile {
  return {
    id: "f1",
    project_id: "p1",
    asset_id: "a1",
    display_name: "Round 1 model",
    notes: null,
    uploaded_by: "u1",
    uploaded_by_display_name: "Ed",
    uploaded_at: "2026-06-12T10:00:00Z",
    size_bytes: 14.2 * 1024 * 1024,
    original_filename: "model.hbjson",
    extraction_status: "pending",
    extraction_error: null,
    ...overrides,
  };
}

function idleUploadFlow(overrides: Partial<HbjsonUploadFlow> = {}): HbjsonUploadFlow {
  return {
    progress: null,
    notice: null,
    isUploading: false,
    handleFile: vi.fn(),
    clearNotice: vi.fn(),
    ...overrides,
  };
}

function renderPopover(props: Partial<Parameters<typeof FilePopover>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FilePopover
        projectId="p1"
        files={[file({})]}
        activeFileId="f1"
        isEditor
        uploadFlow={idleUploadFlow()}
        onSelect={vi.fn()}
        onDeleted={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("FilePopover", () => {
  test("editors see the drop zone and the full row menu", async () => {
    renderPopover();
    expect(screen.getByText(/Drop a/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Actions for Round 1 model" }));
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Edit notes/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Download/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toBeInTheDocument();
  });

  test("viewers get no drop zone and a download-only menu", async () => {
    renderPopover({ isEditor: false });
    expect(screen.queryByText(/Drop a/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Actions for Round 1 model" }));
    expect(screen.getByRole("menuitem", { name: /Download/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Rename/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Delete/ })).not.toBeInTheDocument();
  });

  test("newest row carries (Latest) independent of the active checkmark", () => {
    const newest = file({ id: "f2", display_name: "Round 2 model" });
    const older = file({ id: "f1" });
    const { container } = renderPopover({ files: [newest, older], activeFileId: "f1" });

    const latest = screen.getByText("(Latest)");
    expect(latest).toBeInTheDocument();
    expect(latest.closest(".model-file-row")).toHaveTextContent("Round 2 model");
    expect(container.querySelector(".model-file-row.active")).toHaveTextContent("Round 1 model");
  });

  test("failed extraction renders the quiet badge with the error tooltip", () => {
    renderPopover({
      files: [file({ extraction_status: "failed", extraction_error: "junk JSON" })],
    });
    const badge = screen.getByText("Failed to parse");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "junk JSON");
  });

  test("duplicate notice offers Switch, which selects the existing file", async () => {
    const onSelect = vi.fn();
    const clearNotice = vi.fn();
    renderPopover({
      onSelect,
      uploadFlow: idleUploadFlow({
        clearNotice,
        notice: {
          kind: "duplicate",
          message: "This file matches an existing upload (Round 1 model). Switch to it instead?",
          existingFileId: "f1",
        },
      }),
    });

    expect(screen.getByText(/matches an existing upload/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect(clearNotice).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("f1");
  });

  test("validation errors render inline under the drop zone", () => {
    renderPopover({
      uploadFlow: idleUploadFlow({
        notice: { kind: "error", message: "Only .hbjson files are supported." },
      }),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Only .hbjson files are supported.");
  });
});
