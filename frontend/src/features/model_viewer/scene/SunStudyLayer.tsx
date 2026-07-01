import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import type { Box3 } from "three";
import { VIEWER_SUN_MARKER_COLOR } from "../lib/colorTokens";
import { altitudeDeg, sunIntensityFactor, type SunVector } from "../lib/sunStudy";
import { sunPathFitTransform } from "./sunPathGeometry";

/** Marker radius as a fraction of the dome radius (PRD §5.1). */
const MARKER_RADIUS_FRACTION = 0.015;
/** Shadow-catcher half-extent as a multiple of the dome fit radius (D-4). */
const CATCHER_RADIUS_FACTOR = 2;
/** Small lift above the model base so the catcher never z-fights the grid. */
const CATCHER_Z_EPSILON = 0.03;

const noRaycast = () => null;

/**
 * The engaged sun-study scene objects (PRD §5): the amber "sun right now"
 * marker riding the dome, and the `ShadowMaterial` ground catcher that is
 * invisible except where shadow falls. Both are non-pickable; the marker
 * fades out with the same horizon ramp as the sun light, so the whole system
 * dies off together at dusk. Mounted only while sun study is engaged in the
 * site-sun lens — the perf budget while disengaged is exactly zero (§7).
 */
export function SunStudyLayer({ bounds, sunVector }: { bounds: Box3; sunVector: SunVector }) {
  const fit = useMemo(() => sunPathFitTransform(bounds), [bounds]);
  const altitude = altitudeDeg(sunVector);
  // Marker visibility mirrors the light ramp; fully below horizon it hides.
  const markerOpacity = sunIntensityFactor(altitude + 2);

  // Demand frameloop: repaint whenever the scrubbed direction changes.
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    return () => invalidate();
  }, [sunVector, invalidate]);

  return (
    <group name="sun-study">
      <mesh
        name="sun-study-marker"
        position={[
          fit.position[0] + sunVector[0] * fit.scale,
          fit.position[1] + sunVector[1] * fit.scale,
          fit.position[2] + sunVector[2] * fit.scale,
        ]}
        visible={markerOpacity > 0}
        raycast={noRaycast}
      >
        <sphereGeometry args={[fit.scale * MARKER_RADIUS_FRACTION, 24, 16]} />
        <meshBasicMaterial color={VIEWER_SUN_MARKER_COLOR} transparent opacity={markerOpacity} />
      </mesh>
      <mesh
        name="sun-study-shadow-catcher"
        position={[fit.position[0], fit.position[1], fit.position[2] + CATCHER_Z_EPSILON]}
        receiveShadow
        raycast={noRaycast}
      >
        <planeGeometry
          args={[fit.scale * CATCHER_RADIUS_FACTOR * 2, fit.scale * CATCHER_RADIUS_FACTOR * 2]}
        />
        <shadowMaterial transparent opacity={0.32} />
      </mesh>
    </group>
  );
}
