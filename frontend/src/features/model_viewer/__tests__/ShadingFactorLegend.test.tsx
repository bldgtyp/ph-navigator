// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ContinuousLegend } from "../components/ContinuousLegend";
import { ModelColorOptions } from "../components/ModelColorOptions";
import { useModelViewerStore } from "../store";

afterEach(() => {
  act(() => useModelViewerStore.setState({ shadingFactorSeason: "summer" }));
});

describe("shading factor controls and legend", () => {
  test("shows the seasonal control only for the theme and updates shared state", () => {
    const { rerender } = render(<ModelColorOptions lens="building" theme="shading-factor" />);
    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Shading factor season" })).toBeInTheDocument();

    act(() => fireEvent.click(screen.getByRole("radio", { name: "Winter" })));
    expect(useModelViewerStore.getState().shadingFactorSeason).toBe("winter");

    rerender(<ModelColorOptions lens="building" theme="boundary" />);
    expect(screen.queryByRole("radiogroup", { name: "Shading factor season" })).toBeNull();
  });

  test("renders fixed non-filtering ticks, endpoints, and Missing count", () => {
    render(
      <ContinuousLegend
        legend={{
          title: "Summer shading factor",
          kind: "continuous",
          rows: [],
          stops: [
            { value: 0, color: "#00224E" },
            { value: 0.25, color: "#3B496C" },
            { value: 0.5, color: "#7D7C78" },
            { value: 0.75, color: "#B9B862" },
            { value: 1, color: "#FDE737" },
          ],
          endpointLabels: { minimum: "Fully shaded", maximum: "Unshaded" },
          missingColor: "#9CA3AF",
          missingCount: 3,
        }}
      />,
    );

    expect(screen.getByText("Summer shading factor")).toBeInTheDocument();
    expect(screen.getByLabelText("Shading factor scale")).toHaveTextContent("00.250.500.751.00");
    expect(screen.getByText("Fully shaded")).toBeInTheDocument();
    expect(screen.getByText("Unshaded")).toBeInTheDocument();
    expect(screen.getByText("Missing").nextElementSibling).toHaveTextContent("3");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
