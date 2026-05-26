import { render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  FieldConfigSectionOptions,
  type OptionSourceRow,
} from "../components/FieldConfigSectionOptions";
import type { FieldOption } from "../types";

// Module-level stable empties mirror the EMPTY_FIELD_OPTIONS /
// EMPTY_OPTION_SOURCE_ROWS constants in FieldConfigModal. Inline `[]`
// at the call site forces a fresh identity each render, which would
// retrigger the reset effect in FieldConfigSectionOptions and loop
// through onDraftChange → parent setState → reset → … producing
// "Maximum update depth exceeded" after a text→single_select save.
const EMPTY_OPTIONS: readonly FieldOption[] = [];
const EMPTY_ROWS: readonly OptionSourceRow[] = [];

describe("FieldConfigSectionOptions", () => {
  test("stable empty sourceOptions reference does not cause unbounded onDraftChange calls", () => {
    const onDraftChange = vi.fn();
    function Harness() {
      // Every onDraftChange triggers a parent re-render. With stable
      // sourceOptions/rows the reset effect must not refire, so the
      // draft-change effect should fire a single time then quiesce.
      const [, setTick] = useState(0);
      return (
        <FieldConfigSectionOptions
          fieldDisplayName="Status"
          sourceOptions={EMPTY_OPTIONS}
          sourceColorCodeOptions
          sourceDefaultOptionId={null}
          rows={EMPTY_ROWS}
          disabled={false}
          onDraftChange={(draft) => {
            onDraftChange(draft);
            setTick((n) => n + 1);
          }}
        />
      );
    }
    expect(() => render(<Harness />)).not.toThrow();
    expect(onDraftChange.mock.calls.length).toBeLessThan(5);
  });
});
