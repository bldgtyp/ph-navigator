import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  ModalLinkedRecordField,
  ModalSingleSelectField,
  NumberField,
  RowEditModal,
  TextField,
} from "../row-edit";
import { useRowEditForm } from "../useRowEditForm";

type Row = { name: string };

function Harness({
  initialRow,
  onSubmit,
  validate,
}: {
  initialRow: Row;
  onSubmit: (row: Row) => Promise<void>;
  validate?: (row: Row) => string | null;
}) {
  const form = useRowEditForm({
    initialRow,
    onSubmit,
    validate,
    failureMessage: "Could not save row.",
  });
  return (
    <RowEditModal
      title="Edit row"
      titleId="edit-row-title"
      onCancel={() => undefined}
      onSubmit={() => void form.save()}
      error={form.error}
      isSaving={form.isSaving}
      submitLabel="Save row"
    >
      <TextField
        label="Name"
        value={form.draft.name}
        onChange={(name) => form.setDraft({ name: name ?? "" })}
      />
    </RowEditModal>
  );
}

describe("row edit shared helpers", () => {
  test("useRowEditForm submits edited draft", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<Harness initialRow={{ name: "Old" }} onSubmit={onSubmit} />);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "New");
    await user.click(screen.getByRole("button", { name: "Save row" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "New" }));
  });

  test("useRowEditForm renders validation errors without submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Harness
        initialRow={{ name: "" }}
        onSubmit={onSubmit}
        validate={(row) => (row.name ? null : "Name is required.")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save row" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("RowEditModal wires delete and frozen chrome", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onSubmit = vi.fn();

    render(
      <RowEditModal
        title="Frozen row"
        titleId="frozen-row-title"
        onCancel={() => undefined}
        onSubmit={onSubmit}
        error={null}
        isSaving={false}
        frozenReason="Draft changed remotely."
        submitLabel="Save row"
        deleteLabel="Delete row"
        onDelete={onDelete}
      >
        <p>Fields</p>
      </RowEditModal>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Draft changed remotely.");
    expect(screen.getByRole("button", { name: "Save row" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Delete row" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("NumberField parses blank input to null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<NumberField label="Airflow" value={12} onChange={onChange} />);
    await user.clear(screen.getByLabelText("Airflow"));

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test("ModalSingleSelectField writes option ids", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ModalSingleSelectField
        label="Inside / Outside"
        value={null}
        placeholder="Unassigned"
        options={[{ id: "inside", label: "Inside", color: "#999999" }]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByLabelText("Inside / Outside"));
    await user.click(screen.getByRole("option", { name: "Inside" }));

    expect(onChange).toHaveBeenCalledWith("inside");
  });

  test("ModalLinkedRecordField confirms selected candidate ids", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ModalLinkedRecordField
        label="Linked ERV unit"
        value={null}
        candidates={[
          { rowId: "erv_1", recordId: "ERV-1" },
          { rowId: "erv_2", recordId: "ERV-2" },
        ]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Linked ERV unit: None" }));
    await user.click(screen.getByRole("radio", { name: "Link ERV-2" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onChange).toHaveBeenCalledWith("erv_2");
  });
});
