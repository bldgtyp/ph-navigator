import { labelForLens } from "../lib/lenses";
import { useModelViewerPerfStore } from "../lib/perf";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";

type PerfOverlayProps = {
  model: BuildingModel | null;
};

const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/**
 * Dev-only fixed-corner readout of renderer cost for the Phase-00 perf harness.
 * Render outside `<Canvas>` and gate the mount on `isModelViewerDebugHookEnabled()`.
 * Numbers come from {@link ModelViewerPerfProbe}; lens + object count come from
 * viewer state so a reader can tie a draw-call number to the active lens.
 *
 * Hidden by default — toggle it on with the perf button beside the scene-info
 * button (see `LegendCard`). It stays mounted (so the probe keeps sampling)
 * regardless, and only this readout is shown/hidden.
 */
export function ModelViewerPerfOverlay({ model }: PerfOverlayProps) {
  const sample = useModelViewerPerfStore((state) => state.sample);
  const overlayVisible = useModelViewerPerfStore((state) => state.overlayVisible);
  const lens = useModelViewerStore((state) => state.lens);
  const objectCount = model?.objects.length ?? 0;
  // fps is derived from frameMs, so a single timing guard covers both rows.
  const hasTiming = sample.frameMs > 0;

  if (!overlayVisible) return null;
  return (
    <dl className="model-perf-overlay" aria-hidden="true">
      <PerfRow label="calls" value={integer.format(sample.calls)} />
      <PerfRow label="tris" value={integer.format(sample.triangles)} />
      <PerfRow label="fps" value={hasTiming ? sample.fps.toFixed(0) : "—"} />
      <PerfRow label="ms" value={hasTiming ? sample.frameMs.toFixed(1) : "—"} />
      <PerfRow label="geom" value={integer.format(sample.geometries)} />
      <PerfRow label="prog" value={integer.format(sample.programs)} />
      <PerfRow label={labelForLens(lens)} value={integer.format(objectCount)} />
    </dl>
  );
}

function PerfRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="model-perf-overlay-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
