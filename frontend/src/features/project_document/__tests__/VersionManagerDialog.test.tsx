import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";
import { createDeferred } from "../../../test-utils/async";
import type { ProjectVersion } from "../../projects/types";
import { VersionManagerDialog } from "../components/VersionManagerDialog";

const versions: ProjectVersion[] = [
  {
    id: "default",
    project_id: "project",
    name: "Working",
    kind: "working",
    locked: false,
    schema_version: 9,
    body_size_bytes: 1,
    created_at: "2026-08-18T12:00:00Z",
    updated_at: "2026-08-19T18:30:00Z",
  },
  {
    id: "submitted",
    project_id: "project",
    name: "Round 1",
    kind: "submitted",
    locked: true,
    schema_version: 9,
    body_size_bytes: 1,
    created_at: "2026-08-18T12:00:00Z",
    updated_at: "2026-08-19T19:45:00Z",
  },
];

function renderManager(overrides: Partial<ComponentProps<typeof VersionManagerDialog>> = {}) {
  const props: ComponentProps<typeof VersionManagerDialog> = {
    versions,
    activeVersionId: "default",
    defaultVersionId: "default",
    onOpenVersion: vi.fn(),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  const view = render(<VersionManagerDialog {...props} />);
  return { props, ...view };
}

describe("VersionManagerDialog", () => {
  test("renders metadata and protects the active/default version", () => {
    renderManager();

    expect(screen.getByText("Working · Default")).toBeInTheDocument();
    expect(screen.getByText("Submitted · Locked")).toBeInTheDocument();
    expect(screen.getAllByText(/Last edited/)).toHaveLength(2);

    const workingRow = screen.getByText("Working", { selector: "strong" }).closest("section");
    expect(workingRow).not.toBeNull();
    expect(within(workingRow!).getByRole("button", { name: "Open Working" })).toBeDisabled();
    expect(within(workingRow!).getByRole("button", { name: "Delete Working" })).toBeDisabled();
    expect(screen.getByText(/default version cannot be deleted/i)).toBeInTheDocument();
  });

  test("renames a locked submitted version with trimmed input", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    renderManager({ onRename });
    const submittedRow = screen.getByText("Round 1", { selector: "strong" }).closest("section");

    fireEvent.click(within(submittedRow!).getByRole("button", { name: "Rename Round 1" }));
    fireEvent.change(screen.getByLabelText("Version name"), { target: { value: "  Final  " } });
    fireEvent.click(screen.getByRole("button", { name: "Rename version" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith("submitted", "Final"));
    await waitFor(() => expect(screen.queryByLabelText("Version name")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Rename Round 1" })).toBeInTheDocument();
  });

  test("requires exact-name confirmation before deleting", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderManager({ onDelete });
    const submittedRow = screen.getByText("Round 1", { selector: "strong" }).closest("section");

    fireEvent.click(within(submittedRow!).getByRole("button", { name: "Delete Round 1" }));
    const submit = screen.getByRole("button", { name: "Delete version" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type Round 1 to confirm/), {
      target: { value: "Round 1" },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("submitted", "Round 1"));
    await waitFor(() =>
      expect(screen.queryByLabelText(/Type Round 1 to confirm/)).not.toBeInTheDocument(),
    );
  });

  test("keeps a destructive action stable and non-dismissible while pending", async () => {
    const pendingDelete = createDeferred<void>();
    const onDelete = vi.fn(() => pendingDelete.promise);
    renderManager({ onDelete });

    fireEvent.click(screen.getByRole("button", { name: "Delete Round 1" }));
    fireEvent.change(screen.getByLabelText(/Type Round 1 to confirm/), {
      target: { value: "Round 1" },
    });
    const submit = screen.getByRole("button", { name: "Delete version" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByLabelText(/Type Round 1 to confirm/)).toBeInTheDocument();

    pendingDelete.resolve(undefined);
    await waitFor(() =>
      expect(screen.queryByLabelText(/Type Round 1 to confirm/)).not.toBeInTheDocument(),
    );
  });

  test("keeps a rejected rename open with an inline error", async () => {
    renderManager({ onRename: vi.fn().mockRejectedValue(new Error("Name already exists")) });

    fireEvent.click(screen.getByRole("button", { name: "Rename Round 1" }));
    fireEvent.change(screen.getByLabelText("Version name"), { target: { value: "Duplicate" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename version" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Name already exists");
    expect(screen.getByLabelText("Version name")).toHaveValue("Duplicate");
  });

  test("returns to the refreshed list when the selected version disappears", () => {
    const view = renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Delete Round 1" }));

    view.rerender(<VersionManagerDialog {...view.props} versions={[versions[0]!]} />);

    expect(screen.queryByLabelText(/Type Round 1 to confirm/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename Working" })).toBeInTheDocument();
  });
});
