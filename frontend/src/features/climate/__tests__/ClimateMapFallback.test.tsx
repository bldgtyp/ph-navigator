import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  ClimateMap,
  ClimateMapTileLoadingOverlay,
  type ClimateMapStation,
} from "../components/ClimateMap";

// Under vitest `import.meta.env.MODE === "test"`, so `<ClimateMap>` renders the
// deterministic `placePins` fallback (no Leaflet, no tiles). These exercise the
// generalized P3 surface: project-pin-only vs the picker's station mode.

const PROJECT = { latitude: 42.3, longitude: -73.4 };
const STATIONS: ClimateMapStation[] = [
  { id: "a", name: "Alpha", latitude: 42.4, longitude: -73.3, status: "pass" },
  { id: "b", name: "Bravo", latitude: 42.7, longitude: -73.8, status: "fail" },
];

describe("ClimateMap fallback", () => {
  test("project-pin-only: renders the map region but no station pins", () => {
    render(<ClimateMap project={PROJECT} ariaLabel="Project location map" />);
    expect(screen.getByRole("group", { name: "Project location map" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("null project: renders the decorative empty surface (no map region)", () => {
    const { container } = render(<ClimateMap project={null} className="climate-big-map" />);
    expect(screen.queryByRole("group")).toBeNull();
    const surface = container.querySelector(".climate-map.climate-big-map");
    expect(surface).toHaveAttribute("aria-hidden", "true");
    expect(surface).toBeEmptyDOMElement();
  });

  test("station mode: renders selectable pins that report the clicked id", async () => {
    const onSelectStation = vi.fn();
    render(<ClimateMap project={PROJECT} stations={STATIONS} onSelectStation={onSelectStation} />);

    await userEvent.click(screen.getByRole("button", { name: "Select Alpha" }));
    expect(onSelectStation).toHaveBeenCalledWith("a");
  });

  test("ariaHidden hides the map from the a11y tree (decorative thumbnail)", () => {
    const { container } = render(<ClimateMap project={PROJECT} ariaHidden interactive={false} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"].climate-map')).toBeInTheDocument();
  });

  test("applies the sizing className to the map frame", () => {
    const { container } = render(<ClimateMap project={PROJECT} className="climate-big-map" />);
    expect(container.querySelector(".climate-map.climate-big-map")).toBeInTheDocument();
  });

  test("tile-loading overlay can render accessibly on big maps and decoratively on mini maps", () => {
    const { container } = render(
      <>
        <div className="climate-map climate-big-map">
          <ClimateMapTileLoadingOverlay ariaHidden={false} />
        </div>
        <div className="climate-map climate-mini-map">
          <ClimateMapTileLoadingOverlay ariaHidden />
        </div>
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading map");
    expect(container.querySelector(".climate-big-map .climate-map-loading")).toBeInTheDocument();
    expect(container.querySelector(".climate-mini-map .climate-map-loading")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
