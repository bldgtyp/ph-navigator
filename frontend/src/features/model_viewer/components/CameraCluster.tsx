import { Home, Maximize2, Ruler, Scissors } from "lucide-react";
import type { Box3 } from "three";
import {
  defaultSectionForBounds,
  sectionForAxis,
  sectionRangeForBounds,
  type SectionAxis,
} from "../lib/section";
import { useModelViewerStore } from "../store";

const SECTION_AXES: SectionAxis[] = ["x", "y", "z"];

export function CameraCluster({ modelBounds }: { modelBounds: Box3 | null }) {
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const toggleMeasure = useModelViewerStore((state) => state.toggleMeasure);
  const section = useModelViewerStore((state) => state.section);
  const setSection = useModelViewerStore((state) => state.setSection);
  const clearSection = useModelViewerStore((state) => state.clearSection);
  const sectionRange =
    section && modelBounds ? sectionRangeForBounds(modelBounds, section.axis) : null;

  const toggleSection = () => {
    if (!modelBounds) return;
    if (section) {
      clearSection();
      return;
    }
    setSection(defaultSectionForBounds(modelBounds));
  };

  return (
    <div className="model-camera-cluster" aria-label="Camera controls">
      <button
        type="button"
        aria-label="Fit model"
        title="Fit model"
        onClick={() => requestCamera("fit")}
      >
        <Maximize2 size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Home view"
        title="Home view"
        onClick={() => requestCamera("home")}
      >
        <Home size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={measureActive ? "Exit measure mode" : "Measure distance"}
        aria-pressed={measureActive}
        title={measureActive ? "Exit measure mode" : "Measure distance"}
        className={measureActive ? "active" : undefined}
        onClick={toggleMeasure}
      >
        <Ruler size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={section ? "Disable section plane" : "Enable section plane"}
        aria-pressed={Boolean(section)}
        title={section ? "Disable section plane" : "Enable section plane"}
        className={section ? "active" : undefined}
        onClick={toggleSection}
        disabled={!modelBounds}
      >
        <Scissors size={16} aria-hidden />
      </button>
      {section && modelBounds && sectionRange ? (
        <div className="model-section-controls" aria-label="Section plane controls">
          <div className="model-section-axis-group" role="group" aria-label="Section axis">
            {SECTION_AXES.map((axis) => (
              <button
                key={axis}
                type="button"
                className={section.axis === axis ? "active" : undefined}
                aria-pressed={section.axis === axis}
                aria-label={`Set section axis ${axis.toUpperCase()}`}
                title={`Section ${axis.toUpperCase()}`}
                onClick={() => setSection(sectionForAxis(modelBounds, axis, section))}
              >
                {axis.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="model-section-slider">
            <span>{section.axis.toUpperCase()}</span>
            <input
              type="range"
              min={sectionRange.min}
              max={sectionRange.max}
              step={sectionRange.step}
              value={section.offset}
              aria-label={`Section ${section.axis.toUpperCase()} offset`}
              onChange={(event) =>
                setSection({ axis: section.axis, offset: Number(event.currentTarget.value) })
              }
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
