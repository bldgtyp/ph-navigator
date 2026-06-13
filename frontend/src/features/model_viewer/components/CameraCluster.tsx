import { Home, Maximize2 } from "lucide-react";
import { useModelViewerStore } from "../store";

export function CameraCluster() {
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
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
    </div>
  );
}
