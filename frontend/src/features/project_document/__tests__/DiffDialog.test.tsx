import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ProjectVersion } from "../../projects/types";
import type { DiffSummary } from "../types";
import { DiffDialog } from "../components/DiffDialog";

const versions: ProjectVersion[] = [
  version("working", "Working"),
  version("round-1", "Round 1"),
  version("round-2", "Round 2"),
];

const diff: DiffSummary = {
  project_id: "project",
  from_version_id: "working",
  to_version_id: "round-1",
  tables: [
    {
      table: "project_materials",
      table_label: "Materials",
      change_count: 3,
      changed_paths: ["project_materials.rows[mat-1].conductivity_w_mk"],
      added_count: 1,
      removed_count: 1,
      changed_count: 1,
      changes: [
        {
          operation: "changed",
          record_id: "mat-1",
          record_label: "Roxul SmartRock",
          field_key: "conductivity_w_mk",
          field_label: "Conductivity",
          before: 0.036,
          after: 0.034,
          raw_paths: ["project_materials.rows[mat-1].conductivity_w_mk"],
        },
        {
          operation: "added",
          record_id: "mat-2",
          record_label: "Cellulose",
          field_key: null,
          field_label: null,
          before: null,
          after: { name: "Cellulose", conductivity_w_mk: 0.04 },
          raw_paths: ["project_materials.rows[mat-2]"],
        },
        {
          operation: "removed",
          record_id: "mat-3",
          record_label: "Old insulation",
          field_key: null,
          field_label: null,
          before: { name: "Old insulation" },
          after: null,
          raw_paths: ["project_materials.rows[mat-3]"],
        },
      ],
    },
  ],
};

function renderDialog(overrides: Partial<Parameters<typeof DiffDialog>[0]> = {}) {
  const props: Parameters<typeof DiffDialog>[0] = {
    versions,
    fromVersionId: "working",
    diffTarget: "round-1",
    diffData: diff,
    isLoading: false,
    error: null,
    onFromChange: vi.fn(),
    onTargetChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DiffDialog {...props} />) };
}

describe("DiffDialog", () => {
  test("keeps direction explicit and never offers draft as From or self as To", () => {
    const onFromChange = vi.fn();
    const onTargetChange = vi.fn();
    renderDialog({ onFromChange, onTargetChange });
    expect(screen.getByRole("heading", { name: "Compare versions" })).toBeInTheDocument();

    const from = screen.getByRole("combobox", { name: "From" });
    fireEvent.focus(from);
    let options = within(screen.getByRole("listbox"));
    expect(options.getByRole("option", { name: "Working" })).toBeInTheDocument();
    expect(options.getByRole("option", { name: "Round 1" })).toBeInTheDocument();
    expect(options.queryByRole("option", { name: "Current draft" })).not.toBeInTheDocument();
    fireEvent.click(options.getByRole("option", { name: "Round 2" }));
    expect(onFromChange).toHaveBeenCalledWith("round-2");

    const to = screen.getByRole("combobox", { name: "To" });
    fireEvent.pointerDown(to);
    fireEvent.focus(to);
    options = within(screen.getByRole("listbox"));
    expect(options.getByRole("option", { name: "Current draft" })).toBeInTheDocument();
    expect(options.getByRole("option", { name: "Round 1" })).toBeInTheDocument();
    expect(options.queryByRole("option", { name: "Working" })).not.toBeInTheDocument();
    fireEvent.click(options.getByRole("option", { name: "Current draft" }));
    expect(onTargetChange).toHaveBeenCalledWith("draft");
  });

  test("renders labeled changes before disclosed technical paths", async () => {
    renderDialog();

    expect(screen.getByText("Materials")).toBeInTheDocument();
    expect(screen.getByText("1 added · 1 removed · 1 changed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Materials"));
    expect(await screen.findByText("Roxul SmartRock")).toBeInTheDocument();
    expect(screen.getByText("Conductivity:")).toBeInTheDocument();
    expect(screen.getAllByText("0.036")[0]).toBeVisible();
    expect(screen.getAllByText("0.034")[0]).toBeVisible();
    expect(screen.getByText("2 fields")).toBeInTheDocument();
    expect(screen.getByText("Old insulation")).toBeInTheDocument();
    expect(screen.queryByText(/project_materials\.rows\[mat-1\]/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Technical details")[0]!);
    expect(
      await screen.findByText("project_materials.rows[mat-1].conductivity_w_mk"),
    ).toBeVisible();
    fireEvent.click(screen.getAllByText("Technical details")[0]!);
    await waitFor(() =>
      expect(
        screen.queryByText("project_materials.rows[mat-1].conductivity_w_mk"),
      ).not.toBeInTheDocument(),
    );
  });

  test("shows bounded loading, error, and no-change states", () => {
    const view = renderDialog({ isLoading: true, diffData: undefined });
    expect(screen.getByText("Loading comparison…")).toBeInTheDocument();

    view.rerender(<DiffDialog {...view.props} isLoading={false} error={new Error("Offline")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");

    view.rerender(
      <DiffDialog
        {...view.props}
        isLoading={false}
        error={null}
        diffData={{ ...diff, tables: [] }}
      />,
    );
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  test("keeps string whitespace and empty values explicit", async () => {
    const longValue = "x".repeat(200);
    const stringDiff: DiffSummary = {
      ...diff,
      tables: [
        {
          ...diff.tables[0]!,
          added_count: 0,
          removed_count: 0,
          changed_count: 2,
          changes: [
            { ...diff.tables[0]!.changes[0]!, before: "", after: "   " },
            {
              ...diff.tables[0]!.changes[0]!,
              field_key: "notes",
              field_label: "Notes",
              before: "short",
              after: longValue,
            },
          ],
        },
      ],
    };
    renderDialog({ diffData: stringDiff });
    fireEvent.click(screen.getByText("Materials"));

    expect(await screen.findByText('""')).toBeVisible();
    expect(
      [...document.querySelectorAll(".diff-value")].some(
        (element) => element.textContent === '"   "',
      ),
    ).toBe(true);
    expect(screen.getByText(/^"x{20}/)).toHaveTextContent(/…$/);
  });

  test("Escape closes an open selector before it closes the modal", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    const from = screen.getByRole("combobox", { name: "From" });
    fireEvent.focus(from);

    fireEvent.keyDown(from, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("uses viewport-safe resizable chrome with a footer Close action", () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    const dialog = screen.getByRole("dialog", { name: "Compare versions" });
    expect(dialog).toHaveClass("modal-panel--resizable", "modal-panel--scroll-body");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function version(id: string, name: string): ProjectVersion {
  return {
    id,
    project_id: "project",
    name,
    kind: "working",
    locked: false,
    schema_version: 9,
    body_size_bytes: 1,
    created_at: "2026-08-18T12:00:00Z",
    updated_at: "2026-08-19T18:30:00Z",
  };
}
