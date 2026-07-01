import { useEffect } from "react";
import { installRenderSettingsWindowMirror, useViewerRenderSettings } from "../lib/renderSettings";

const degrees = (value: number) => `${value.toFixed(0)}°`;

/**
 * Dev-only render-knob panel (rendering-style refactor,
 * `planning/refactor/model-viewer-rendering-style/`). Retunes the shipped
 * study-model look live on a real model, and installs the `window.__phnViewerRender`
 * mirror the Playwright perf harness drives. Mount only when the debug hook is
 * enabled (ModelViewerStage) — never in production.
 */
export function ViewerRenderControls() {
  const ao = useViewerRenderSettings((s) => s.ao);
  const aoIntensity = useViewerRenderSettings((s) => s.aoIntensity);
  const aoRadius = useViewerRenderSettings((s) => s.aoRadius);
  const aoHalfRes = useViewerRenderSettings((s) => s.aoHalfRes);
  const aoQuality = useViewerRenderSettings((s) => s.aoQuality);
  const softLighting = useViewerRenderSettings((s) => s.softLighting);
  const keyIntensity = useViewerRenderSettings((s) => s.keyIntensity);
  const fillIntensity = useViewerRenderSettings((s) => s.fillIntensity);
  const keyElevation = useViewerRenderSettings((s) => s.keyElevation);
  const keyAzimuth = useViewerRenderSettings((s) => s.keyAzimuth);
  const shadowMapSize = useViewerRenderSettings((s) => s.shadowMapSize);
  const set = useViewerRenderSettings((s) => s.set);

  // Expose the knobs to the perf harness for the lifetime of the panel.
  useEffect(() => installRenderSettingsWindowMirror(), []);

  return (
    <div className="model-render-controls">
      <div className="model-render-controls-title">render (dev)</div>
      <label className="model-render-controls-row">
        <input type="checkbox" checked={ao} onChange={(e) => set({ ao: e.target.checked })} />
        <span>ambient occlusion</span>
      </label>
      <SliderRow
        label="intensity"
        min={0}
        max={5}
        step={0.1}
        value={aoIntensity}
        disabled={!ao}
        onChange={(v) => set({ aoIntensity: v })}
      />
      <SliderRow
        label="radius"
        min={0.1}
        max={4}
        step={0.1}
        value={aoRadius}
        disabled={!ao}
        onChange={(v) => set({ aoRadius: v })}
      />
      <label className="model-render-controls-row">
        <input
          type="checkbox"
          checked={aoHalfRes}
          disabled={!ao}
          onChange={(e) => set({ aoHalfRes: e.target.checked })}
        />
        <span>half-res AO</span>
      </label>
      <label className="model-render-controls-row">
        <span>AO quality</span>
        <select
          value={aoQuality}
          disabled={!ao}
          onChange={(e) => set({ aoQuality: e.target.value as typeof aoQuality })}
        >
          <option value="performance">performance</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </label>
      <label className="model-render-controls-row">
        <input
          type="checkbox"
          checked={softLighting}
          onChange={(e) => set({ softLighting: e.target.checked })}
        />
        <span>soft lighting</span>
      </label>
      <SliderRow
        label="key"
        min={0}
        max={5}
        step={0.1}
        value={keyIntensity}
        disabled={!softLighting}
        onChange={(v) => set({ keyIntensity: v })}
      />
      <SliderRow
        label="fill"
        min={0}
        max={5}
        step={0.1}
        value={fillIntensity}
        disabled={!softLighting}
        onChange={(v) => set({ fillIntensity: v })}
      />
      <SliderRow
        label="sun elev"
        min={5}
        max={90}
        step={1}
        value={keyElevation}
        disabled={!softLighting}
        onChange={(v) => set({ keyElevation: v })}
        format={degrees}
      />
      <SliderRow
        label="sun azim"
        min={0}
        max={360}
        step={1}
        value={keyAzimuth}
        disabled={!softLighting}
        onChange={(v) => set({ keyAzimuth: v })}
        format={degrees}
      />
      <label className="model-render-controls-row">
        <span>shadow map</span>
        <select
          value={shadowMapSize}
          onChange={(e) => set({ shadowMapSize: Number(e.target.value) })}
        >
          <option value={512}>512</option>
          <option value={1024}>1024</option>
          <option value={2048}>2048</option>
          <option value={4096}>4096</option>
        </select>
      </label>
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
  format = (v) => v.toFixed(1),
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="model-render-controls-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="model-render-controls-val">{format(value)}</span>
    </label>
  );
}
