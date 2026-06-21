import { errorMessage } from "../../../shared/lib/errors";
import { useSunPathQuery } from "../hooks";
import { buildSunPathGeometry, SUN_PATH_VIEWBOX } from "../sun-path";
import type { SunPathAndCompass } from "../types";

// The project sun-path visual: the Phase-1 `/sun-path` diagram projected
// top-down to a 2D SVG (compass rings + azimuth ticks, the hourly analemma
// figure-8s, and the monthly day arcs). Shows a "Set location" empty state
// when the project location is unset (the endpoint returns null).
export function SunPathDiagram({ projectId }: { projectId: string }) {
  const sunPathQuery = useSunPathQuery(projectId);

  if (sunPathQuery.isLoading) {
    return <p className="form-note">Loading sun path…</p>;
  }
  if (sunPathQuery.error) {
    return (
      <p className="form-error">
        {errorMessage(sunPathQuery.error, "Could not load the sun path.")}
      </p>
    );
  }
  if (!sunPathQuery.data) {
    return <p className="form-note">Set the project location to see its sun-path diagram.</p>;
  }

  return <SunPathSvg data={sunPathQuery.data} />;
}

function SunPathSvg({ data }: { data: SunPathAndCompass }) {
  const { analemmas, dayArcs, rings, ticks } = buildSunPathGeometry(data);
  return (
    <svg
      className="climate-sun-path"
      viewBox={`0 0 ${SUN_PATH_VIEWBOX} ${SUN_PATH_VIEWBOX}`}
      role="img"
      aria-label="Sun-path diagram for the project location"
    >
      <g className="climate-sun-path-compass">
        {rings.map((ring, index) => (
          <circle key={`ring:${index}`} cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" />
        ))}
        {ticks.map((tick, index) => (
          <line key={`tick:${index}`} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />
        ))}
      </g>
      <g className="climate-sun-path-arcs">
        {dayArcs.map((path, index) => (
          <path key={`arc:${index}`} d={path} fill="none" />
        ))}
      </g>
      <g className="climate-sun-path-analemmas">
        {analemmas.map((path, index) => (
          <path key={`analemma:${index}`} d={path} fill="none" />
        ))}
      </g>
      <g className="climate-sun-path-labels" aria-hidden="true">
        <text x="120" y="12" textAnchor="middle">
          N
        </text>
        <text x="228" y="124" textAnchor="middle">
          E
        </text>
        <text x="120" y="236" textAnchor="middle">
          S
        </text>
        <text x="12" y="124" textAnchor="middle">
          W
        </text>
      </g>
    </svg>
  );
}
