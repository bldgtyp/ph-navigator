// Modal section disabling under the per-attribute lock list.
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { FieldConfigModal } from "../components/FieldConfigModal";
import type { CustomFieldType, FieldDef } from "../types";

function Harness({ field }: { field: FieldDef | undefined }) {
  const [open, setOpen] = useState(true);
  return (
    <FieldConfigModal
      open={open}
      onOpenChange={setOpen}
      fieldDef={field}
      existingFieldLabels={[]}
      dispatchBundle={vi.fn().mockResolvedValue(undefined)}
      sourceCustomFieldType={field?.custom_field_type as CustomFieldType | undefined}
    />
  );
}

describe("FieldConfigModal — per-attribute lock list", () => {
  test("opens for a built-in field with default locks (delete/duplicate only)", () => {
    const builtIn: FieldDef = {
      field_key: "number",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Number",
      built_in: true,
      locked: ["delete", "duplicate"],
    };
    render(<Harness field={builtIn} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).not.toBeDisabled();
    expect(screen.getByLabelText("Description")).not.toBeDisabled();
  });

  test("type picker stays enabled on unlocked built-in field types", () => {
    const builtIn: FieldDef = {
      field_key: "number",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Number",
      built_in: true,
      locked: ["delete", "duplicate"],
    };
    render(<Harness field={builtIn} />);
    const typePicker = screen.getByRole("combobox", { name: "Field type" });
    expect(typePicker).not.toBeDisabled();
    expect(typePicker).not.toHaveAttribute("title", "Field Locked");
  });

  test("field_type in the lock list disables the type picker on built-ins", () => {
    const builtIn: FieldDef = {
      field_key: "floor_level",
      field_type: "single_select",
      custom_field_type: "single_select",
      display_name: "Floor",
      built_in: true,
      locked: ["field_type", "delete", "duplicate"],
    };
    render(<Harness field={builtIn} />);
    const typePicker = screen.getByRole("combobox", { name: "Field type" });
    expect(typePicker).toBeDisabled();
  });

  test("display_name in the lock list disables the Name input", () => {
    const fullyLocked: FieldDef = {
      field_key: "datasheet",
      field_type: "attachment",
      display_name: "Datasheet",
      built_in: true,
      locked: [
        "display_name",
        "field_type",
        "options",
        "default",
        "description",
        "formula",
        "delete",
        "duplicate",
      ],
    };
    render(<Harness field={fullyLocked} />);
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Name")).toHaveAttribute("title", "Field Locked");
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toHaveAttribute("title", "Field Locked");
  });

  test("custom (user-created) fields have every section editable by default", () => {
    const custom: FieldDef = {
      field_key: "cf_notes",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Notes",
    };
    render(<Harness field={custom} />);
    expect(screen.getByLabelText("Name")).not.toBeDisabled();
    expect(screen.getByLabelText("Description")).not.toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Field type" })).not.toBeDisabled();
  });
});
