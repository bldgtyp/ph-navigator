import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  FieldConfigSectionLinkedRecord,
  type LinkedRecordTargetTableOption,
} from "../components/FieldConfigSectionLinkedRecord";

const TARGETS: LinkedRecordTargetTableOption[] = [
  { path: ["equipment", "pumps"], label: "Pumps" },
  { path: ["equipment", "ervs"], label: "ERVs" },
];

describe("FieldConfigSectionLinkedRecord", () => {
  test("renders target options and surfaces the placeholder when nothing is selected", () => {
    render(
      <FieldConfigSectionLinkedRecord
        targetPath={null}
        targets={TARGETS}
        onTargetPathChange={vi.fn()}
        maxLinks={1}
        onMaxLinksChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Target table" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Pumps" })).toBeInTheDocument();
  });

  test("change on target dropdown emits the path tuple", () => {
    const onTargetPathChange = vi.fn();
    render(
      <FieldConfigSectionLinkedRecord
        targetPath={null}
        targets={TARGETS}
        onTargetPathChange={onTargetPathChange}
        maxLinks={1}
        onMaxLinksChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Target table" }), {
      target: { value: "equipment/pumps" },
    });
    expect(onTargetPathChange).toHaveBeenCalledWith(["equipment", "pumps"]);
  });

  test("selecting the placeholder clears the target", () => {
    const onTargetPathChange = vi.fn();
    render(
      <FieldConfigSectionLinkedRecord
        targetPath={["equipment", "pumps"]}
        targets={TARGETS}
        onTargetPathChange={onTargetPathChange}
        maxLinks={1}
        onMaxLinksChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Target table" }), {
      target: { value: "" },
    });
    expect(onTargetPathChange).toHaveBeenCalledWith(null);
  });

  test("Single → Multiple toggle emits null (PRD Q3)", () => {
    const onMaxLinksChange = vi.fn();
    render(
      <FieldConfigSectionLinkedRecord
        targetPath={["equipment", "pumps"]}
        targets={TARGETS}
        onTargetPathChange={vi.fn()}
        maxLinks={1}
        onMaxLinksChange={onMaxLinksChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Multiple records/));
    expect(onMaxLinksChange).toHaveBeenCalledWith(null);
  });

  test("Multiple → Single toggle emits 1 (PRD Q3)", () => {
    const onMaxLinksChange = vi.fn();
    render(
      <FieldConfigSectionLinkedRecord
        targetPath={["equipment", "pumps"]}
        targets={TARGETS}
        onTargetPathChange={vi.fn()}
        maxLinks={null}
        onMaxLinksChange={onMaxLinksChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Single record/));
    expect(onMaxLinksChange).toHaveBeenCalledWith(1);
  });

  test("targetLocked disables the target dropdown but leaves cardinality editable (PRD Q13)", () => {
    render(
      <FieldConfigSectionLinkedRecord
        targetPath={["equipment", "pumps"]}
        targets={TARGETS}
        onTargetPathChange={vi.fn()}
        maxLinks={1}
        onMaxLinksChange={vi.fn()}
        targetLocked
      />,
    );
    expect(screen.getByRole("combobox", { name: "Target table" })).toBeDisabled();
    expect(screen.getByLabelText(/Single record/)).not.toBeDisabled();
  });
});
