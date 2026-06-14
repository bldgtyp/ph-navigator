import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { jsonResponse, LOCATION_PROJECT as PROJECT } from "../../projects/testing/locationFixtures";
import { SunPathDiagram } from "../components/SunPathDiagram";
import { buildSunPathGeometry } from "../sun-path";
import type { SunPathAndCompass } from "../types";

const fetchMock = vi.fn();

function makeSunPath(): SunPathAndCompass {
  return {
    sunpath: {
      hourly_analemma_polyline3d: [
        {
          vertices: [
            [0, 1, 0],
            [0.5, 0.5, 0.2],
          ],
        },
      ],
      monthly_day_arc3d: [
        { plane: { n: [0, 0, 1], o: [0, 0, 0], x: [1, 0, 0] }, radius: 1, a1: 0, a2: Math.PI },
      ],
    },
    compass: {
      all_boundary_circles: [{ c: [0, 0], r: 1, a1: 0, a2: 2 * Math.PI }],
      major_azimuth_ticks: [{ p: [0, 1], v: [0, 0.1] }],
      minor_azimuth_ticks: [{ p: [1, 0], v: [0.05, 0] }],
    },
  };
}

function renderDiagram() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SunPathDiagram projectId={PROJECT.id} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("buildSunPathGeometry", () => {
  test("projects every primitive top-down (y flipped) and tessellates arcs", () => {
    const geometry = buildSunPathGeometry(makeSunPath());

    expect(geometry.analemmas).toHaveLength(1);
    // First vertex (0, 1) → center x, top of the diagram (smaller SVG y).
    expect(geometry.analemmas[0]).toMatch(/^M120\.00 20\.00/);
    expect(geometry.dayArcs).toHaveLength(1);
    expect(geometry.dayArcs[0]?.startsWith("M")).toBe(true);
    expect(geometry.rings).toEqual([{ cx: 120, cy: 120, r: 100 }]);
    // Major + minor ticks are merged into one tick list.
    expect(geometry.ticks).toHaveLength(2);
  });
});

describe("SunPathDiagram", () => {
  test("renders the SVG when the endpoint returns a diagram", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(() => jsonResponse(makeSunPath()));

    renderDiagram();

    expect(await screen.findByRole("img", { name: /sun-path diagram/i })).toBeInTheDocument();
  });

  test("shows the empty state when the location is unset (null response)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(() => jsonResponse(null));

    renderDiagram();

    expect(await screen.findByText(/set the project location/i)).toBeInTheDocument();
  });
});
