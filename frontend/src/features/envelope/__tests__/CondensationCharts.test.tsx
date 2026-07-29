import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AccumulatedMoistureChart,
  TemperatureProfileChart,
} from "../components/CondensationCharts";
import { screenedCondensationResult } from "./condensation-test-fixture";

describe("condensation charts", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 800,
      bottom: 280,
      left: 0,
      width: 800,
      height: 280,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("extends the moisture domain to show a selected limit beyond the data", () => {
    const result = screenedCondensationResult({
      settings: {
        ...screenedCondensationResult().settings,
        ma_limit_g_m2: 400,
      },
    });

    render(<AccumulatedMoistureChart result={result} />);

    expect(screen.getByText("Limit 400 g/m²")).toBeInTheDocument();
  });

  test("extends the temperature domain to show off-profile risk thresholds", () => {
    const baselineMonth = screenedCondensationResult().monthly[0]!;
    const month = {
      ...baselineMonth,
      mold_threshold_c: 30,
      dewpoint_threshold_c: 35,
    };

    render(<TemperatureProfileChart month={month} axis="sd" />);

    expect(screen.getByText("80% RH mould threshold")).toBeInTheDocument();
    expect(screen.getByText("100% RH condensation threshold")).toBeInTheDocument();
  });
});
